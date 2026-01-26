/**
 * Crew Rates Hooks
 * Handles day rate schedules for cast and crew members
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/context/AuthContext';
import type {
  CrewRate,
  CrewRateInput,
  CrewRatesResponse,
  CrewRateResponse,
  BacklotBookedPerson,
} from '@/types/backlot';
import { parseBookingRate } from '@/lib/rateUtils';

const API_BASE = import.meta.env.VITE_API_URL || '';

// =============================================================================
// CREW RATES QUERIES
// =============================================================================

/**
 * Get all crew rates for a project
 */
export function useCrewRates(
  projectId: string | undefined,
  options?: {
    userId?: string;
    roleId?: string;
  }
) {
  const { session } = useAuth();

  return useQuery({
    queryKey: ['backlot-crew-rates', projectId, options],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (options?.userId) params.append('user_id', options.userId);
      if (options?.roleId) params.append('role_id', options.roleId);

      const response = await fetch(
        `${API_BASE}/api/v1/backlot/projects/${projectId}/crew-rates?${params}`,
        {
          headers: {
            Authorization: `Bearer ${session?.access_token}`,
          },
        }
      );
      if (!response.ok) throw new Error('Failed to fetch crew rates');
      const result: CrewRatesResponse = await response.json();
      return result.rates;
    },
    enabled: !!projectId && !!session?.access_token,
  });
}

/**
 * Get a single crew rate by ID
 */
export function useCrewRate(rateId: string | undefined) {
  const { session } = useAuth();

  return useQuery({
    queryKey: ['backlot-crew-rate', rateId],
    queryFn: async () => {
      const response = await fetch(
        `${API_BASE}/api/v1/backlot/crew-rates/${rateId}`,
        {
          headers: {
            Authorization: `Bearer ${session?.access_token}`,
          },
        }
      );
      if (!response.ok) throw new Error('Failed to fetch crew rate');
      const result: CrewRateResponse = await response.json();
      return result.rate;
    },
    enabled: !!rateId && !!session?.access_token,
  });
}

/**
 * Get crew rates for a specific user on a project
 */
export function useCrewRatesByUser(
  projectId: string | undefined,
  userId: string | undefined,
  effectiveDate?: string
) {
  const { session } = useAuth();

  return useQuery({
    queryKey: ['backlot-crew-rates-by-user', projectId, userId, effectiveDate],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (effectiveDate) params.append('effective_date', effectiveDate);

      const response = await fetch(
        `${API_BASE}/api/v1/backlot/projects/${projectId}/crew-rates/by-user/${userId}?${params}`,
        {
          headers: {
            Authorization: `Bearer ${session?.access_token}`,
          },
        }
      );
      if (!response.ok) throw new Error('Failed to fetch crew rates by user');
      const result: CrewRatesResponse = await response.json();
      return result.rates;
    },
    enabled: !!projectId && !!userId && !!session?.access_token,
  });
}

/**
 * Get crew rates for a specific role on a project
 */
export function useCrewRatesByRole(
  projectId: string | undefined,
  roleId: string | undefined,
  effectiveDate?: string
) {
  const { session } = useAuth();

  return useQuery({
    queryKey: ['backlot-crew-rates-by-role', projectId, roleId, effectiveDate],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (effectiveDate) params.append('effective_date', effectiveDate);

      const response = await fetch(
        `${API_BASE}/api/v1/backlot/projects/${projectId}/crew-rates/by-role/${roleId}?${params}`,
        {
          headers: {
            Authorization: `Bearer ${session?.access_token}`,
          },
        }
      );
      if (!response.ok) throw new Error('Failed to fetch crew rates by role');
      const result: CrewRatesResponse = await response.json();
      return result.rates;
    },
    enabled: !!projectId && !!roleId && !!session?.access_token,
  });
}

// =============================================================================
// CREW RATES MUTATIONS
// =============================================================================

/**
 * Create, update, delete crew rates
 */
export function useCrewRateMutations(projectId: string | undefined) {
  const { session } = useAuth();
  const queryClient = useQueryClient();

  const createRate = useMutation({
    mutationFn: async (input: CrewRateInput) => {
      const response = await fetch(
        `${API_BASE}/api/v1/backlot/projects/${projectId}/crew-rates`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify(input),
        }
      );
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to create crew rate');
      }
      const result: CrewRateResponse = await response.json();
      return result.rate;
    },
    onSuccess: (rate) => {
      queryClient.invalidateQueries({ queryKey: ['backlot-crew-rates', projectId] });
      if (rate.user_id) {
        queryClient.invalidateQueries({
          queryKey: ['backlot-crew-rates-by-user', projectId, rate.user_id]
        });
      }
      if (rate.role_id) {
        queryClient.invalidateQueries({
          queryKey: ['backlot-crew-rates-by-role', projectId, rate.role_id]
        });
      }
    },
  });

  const updateRate = useMutation({
    mutationFn: async ({ rateId, input }: { rateId: string; input: CrewRateInput }) => {
      const response = await fetch(
        `${API_BASE}/api/v1/backlot/crew-rates/${rateId}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify(input),
        }
      );
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to update crew rate');
      }
      const result: CrewRateResponse = await response.json();
      return result.rate;
    },
    onSuccess: (rate, variables) => {
      queryClient.invalidateQueries({ queryKey: ['backlot-crew-rates', projectId] });
      queryClient.invalidateQueries({ queryKey: ['backlot-crew-rate', variables.rateId] });
      if (rate.user_id) {
        queryClient.invalidateQueries({
          queryKey: ['backlot-crew-rates-by-user', projectId, rate.user_id]
        });
      }
      if (rate.role_id) {
        queryClient.invalidateQueries({
          queryKey: ['backlot-crew-rates-by-role', projectId, rate.role_id]
        });
      }
    },
  });

  const deleteRate = useMutation({
    mutationFn: async (rateId: string) => {
      const response = await fetch(
        `${API_BASE}/api/v1/backlot/crew-rates/${rateId}`,
        {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${session?.access_token}`,
          },
        }
      );
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to delete crew rate');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot-crew-rates', projectId] });
      // Also invalidate all user and role specific queries
      queryClient.invalidateQueries({
        predicate: (query) =>
          query.queryKey[0] === 'backlot-crew-rates-by-user' ||
          query.queryKey[0] === 'backlot-crew-rates-by-role'
      });
    },
  });

  return {
    createRate,
    updateRate,
    deleteRate,
  };
}

// =============================================================================
// UTILITY HOOKS
// =============================================================================

/**
 * Get the effective rate for a user on a specific date
 * Returns the most specific rate: user-specific > role-specific > null
 */
export function useEffectiveCrewRate(
  projectId: string | undefined,
  userId: string | undefined,
  roleId: string | undefined,
  date?: string
) {
  const { session } = useAuth();
  const effectiveDate = date || new Date().toISOString().split('T')[0];

  // Get user-specific rates
  const userRates = useCrewRatesByUser(projectId, userId, effectiveDate);

  // Get role-specific rates (fallback)
  const roleRates = useCrewRatesByRole(projectId, roleId, effectiveDate);

  // Determine the best rate to use
  const effectiveRate: CrewRate | null = (() => {
    // First priority: user-specific rate
    if (userRates.data && userRates.data.length > 0) {
      return userRates.data[0];
    }
    // Second priority: role-specific rate
    if (roleRates.data && roleRates.data.length > 0) {
      return roleRates.data[0];
    }
    return null;
  })();

  return {
    rate: effectiveRate,
    isLoading: userRates.isLoading || roleRates.isLoading,
    error: userRates.error || roleRates.error,
    source: effectiveRate
      ? (userRates.data?.find(r => r.id === effectiveRate.id) ? 'user' : 'role')
      : null,
  };
}

/**
 * Calculate total daily compensation for a crew member
 */
export function calculateDailyCompensation(
  rate: CrewRate | null,
  hours: number = 8,
  overtimeHours: number = 0,
  doubleTimeHours: number = 0
): {
  basePay: number;
  overtimePay: number;
  doubleTimePay: number;
  kitRental: number;
  carAllowance: number;
  phoneAllowance: number;
  totalPay: number;
} {
  if (!rate) {
    return {
      basePay: 0,
      overtimePay: 0,
      doubleTimePay: 0,
      kitRental: 0,
      carAllowance: 0,
      phoneAllowance: 0,
      totalPay: 0,
    };
  }

  let basePay = 0;
  let hourlyRate = 0;

  switch (rate.rate_type) {
    case 'hourly':
      hourlyRate = rate.rate_amount;
      basePay = hours * hourlyRate;
      break;
    case 'daily':
      basePay = rate.rate_amount;
      // For daily rates, calculate hourly equivalent for OT/DT
      hourlyRate = rate.rate_amount / 8;
      break;
    case 'weekly':
      basePay = rate.rate_amount / 5; // Assume 5-day work week
      hourlyRate = rate.rate_amount / 40;
      break;
    case 'flat':
      basePay = rate.rate_amount;
      hourlyRate = 0; // No OT/DT for flat rates
      break;
  }

  const overtimePay = rate.rate_type !== 'flat'
    ? overtimeHours * hourlyRate * rate.overtime_multiplier
    : 0;

  const doubleTimePay = rate.rate_type !== 'flat'
    ? doubleTimeHours * hourlyRate * rate.double_time_multiplier
    : 0;

  const kitRental = rate.kit_rental_rate || 0;
  const carAllowance = rate.car_allowance || 0;
  const phoneAllowance = rate.phone_allowance || 0;

  const totalPay = basePay + overtimePay + doubleTimePay + kitRental + carAllowance + phoneAllowance;

  return {
    basePay,
    overtimePay,
    doubleTimePay,
    kitRental,
    carAllowance,
    phoneAllowance,
    totalPay,
  };
}

/**
 * Automatically create a crew rate from a booked person's booking_rate field
 * This is used when someone is booked via the BookApplicantModal with a rate specified
 */
export function useAutoCreateRateFromBooking(projectId: string | undefined) {
  const { session } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (person: BacklotBookedPerson) => {
      if (!person.booking_rate) {
        throw new Error('No booking rate available for this person');
      }

      const parsed = parseBookingRate(person.booking_rate);
      if (!parsed) {
        throw new Error(`Invalid booking rate format: ${person.booking_rate}`);
      }

      const rateInput: CrewRateInput = {
        user_id: person.user_id,
        role_id: person.role_id,
        rate_type: parsed.period,
        rate_amount: parsed.amount,
        overtime_multiplier: 1.5,
        double_time_multiplier: 2.0,
        effective_start: person.start_date,
        effective_end: person.end_date,
        notes: `Auto-created from booking rate: ${person.booking_rate}`,
        source: 'imported',
      };

      const response = await fetch(
        `${API_BASE}/api/v1/backlot/projects/${projectId}/crew-rates`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify(rateInput),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to create rate from booking');
      }

      const result: CrewRateResponse = await response.json();
      return result.rate;
    },
    onSuccess: (rate) => {
      // Invalidate all relevant queries
      queryClient.invalidateQueries({ queryKey: ['backlot-crew-rates', projectId] });
      queryClient.invalidateQueries({ queryKey: ['backlot-booked-people', projectId] });
      if (rate.user_id) {
        queryClient.invalidateQueries({
          queryKey: ['backlot-crew-rates-by-user', projectId, rate.user_id]
        });
      }
      if (rate.role_id) {
        queryClient.invalidateQueries({
          queryKey: ['backlot-crew-rates-by-role', projectId, rate.role_id]
        });
      }
    },
  });
}
