# Hot Set System Rework - Integration Guide

This guide shows how to integrate the new Hot Set components into HotSetView.tsx

## New Components Created

1. **PreCrewCallCountdown** - Pre-crew call countdown & checklist
2. **TabbedScheduleView** - 3-tab schedule interface (Current/Full/Completed)
3. **HotSetSettingsPanel** - Configuration panel for Hot Set settings
4. **Enhanced ScheduleDeviationCard** - Dual variance display
5. **Enhanced CatchUpSuggestionsPanel** - Compliance warnings

## New Hooks Available

```typescript
import {
  useConfirmCrewCall,
  useConfirmFirstShot,
  useHotSetSettings,
  useUpdateHotSetSettings,
} from '@/hooks/backlot';
```

## Integration Steps

### Step 1: Add Imports to HotSetView.tsx

```typescript
// Add to existing imports from './hot-set'
import {
  // ... existing imports
  PreCrewCallCountdown,
  TabbedScheduleView,
  HotSetSettingsPanel,
} from './hot-set';

// Add to existing hook imports
import {
  // ... existing hooks
  useConfirmCrewCall,
  useConfirmFirstShot,
  useHotSetSettings,
  useUpdateHotSetSettings,
} from '@/hooks/backlot';
```

### Step 2: Add State for Settings Panel

```typescript
const HotSetView: React.FC<HotSetViewProps> = ({ projectId, canEdit }) => {
  // ... existing state

  const [showSettingsPanel, setShowSettingsPanel] = useState(false);

  // Add settings hooks
  const { data: hotSetSettings } = useHotSetSettings(projectId);
  const updateSettings = useUpdateHotSetSettings(projectId);
  const confirmCrewCall = useConfirmCrewCall();
  const confirmFirstShot = useConfirmFirstShot();
```

### Step 3: Handle Pre-Crew Call State

```typescript
// In the main render logic, check if session is auto-started but crew call not confirmed
const isPreCrewCallPhase =
  activeSession &&
  activeSession.status === 'in_progress' &&
  activeSession.auto_started &&
  !activeSession.crew_call_confirmed_at;

const showCountdown = isPreCrewCallPhase &&
  activeSession.backlot_production_days?.general_call_time;
```

### Step 4: Conditional Rendering Logic

```typescript
return (
  <div className="space-y-6">
    {/* Day Selection Header (always show) */}
    <Card>
      {/* ... existing day selection code */}
    </Card>

    {/* Settings Button */}
    {canEdit && (
      <Button
        variant="outline"
        onClick={() => setShowSettingsPanel(!showSettingsPanel)}
      >
        <Settings className="w-4 h-4 mr-2" />
        {showSettingsPanel ? 'Hide Settings' : 'Settings'}
      </Button>
    )}

    {/* Settings Panel (collapsible) */}
    {showSettingsPanel && hotSetSettings && (
      <HotSetSettingsPanel
        settings={hotSetSettings}
        onSave={(settings) => {
          updateSettings.mutate(settings, {
            onSuccess: () => toast.success('Settings saved'),
          });
        }}
        isSaving={updateSettings.isPending}
      />
    )}

    {activeSession && (
      <>
        {/* PRE-CREW CALL PHASE: Show countdown & checklist */}
        {isPreCrewCallPhase && showCountdown && (
          <PreCrewCallCountdown
            session={activeSession}
            crewCallTime={new Date(
              `${activeSession.backlot_production_days.date}T${activeSession.backlot_production_days.general_call_time}`
            )}
            onConfirmCrewCall={() => {
              confirmCrewCall.mutate(activeSession.id, {
                onSuccess: () => {
                  toast.success('Crew call confirmed');
                  refetch(); // Refresh dashboard
                },
              });
            }}
            onConfirmFirstShot={() => {
              confirmFirstShot.mutate(activeSession.id, {
                onSuccess: () => {
                  toast.success('First shot confirmed - day tracking active');
                  refetch();
                },
              });
            }}
            isConfirmingCrewCall={confirmCrewCall.isPending}
            isConfirmingFirstShot={confirmFirstShot.isPending}
          />
        )}

        {/* ACTIVE TRACKING PHASE: Show main dashboard */}
        {(!isPreCrewCallPhase || activeSession.first_shot_confirmed_at) && dashboard && (
          <>
            {/* Enhanced Schedule Deviation Card with Dual Variance */}
            {dashboard.projected_schedule && dashboard.projected_schedule.length > 0 && (
              <ScheduleDeviationCard
                cumulativeVariance={
                  dashboard.projected_schedule.find(i => i.is_current)?.variance_from_plan ?? 0
                }
                realtimeDeviation={
                  dashboard.projected_schedule.find(i => i.is_current)?.realtime_deviation_minutes
                }
                currentItem={
                  dashboard.projected_schedule.find(i => i.is_current)
                }
                currentScene={dashboard.current_scene}
                onViewSuggestions={() => {/* scroll to suggestions */}}
                hasSuggestions={dashboard.catch_up_suggestions && dashboard.catch_up_suggestions.length > 0}
              />
            )}

            {/* Replace LiveScheduleView with TabbedScheduleView */}
            {dashboard.projected_schedule && dashboard.projected_schedule.length > 0 && (
              <TabbedScheduleView
                items={dashboard.projected_schedule}
                currentScene={dashboard.current_scene}
                nextScenes={dashboard.next_scenes}
                isActive={activeSession.status === 'in_progress'}
                isWrapped={activeSession.status === 'wrapped'}
                canEdit={canEdit}
                defaultTab={hotSetSettings?.default_schedule_view || 'current'}
                onStartScene={(sceneId) => startScene.mutate({ sessionId: activeSession.id, sceneId })}
                onCompleteScene={(sceneId) => completeScene.mutate({ sessionId: activeSession.id, sceneId })}
                onSkipScene={(sceneId) => skipScene.mutate({ sessionId: activeSession.id, sceneId })}
                onStartActivity={(blockId) => startScheduleBlock.mutate({ sessionId: activeSession.id, blockId })}
                onCompleteActivity={(blockId) => completeScheduleBlock.mutate({ sessionId: activeSession.id, blockId })}
                onSkipActivity={(blockId) => skipScheduleBlock.mutate({ sessionId: activeSession.id, blockId })}
                onStartDay={() => startSession.mutate(activeSession.id)}
                isStartingScene={startScene.isPending}
                isCompletingScene={completeScene.isPending}
                isSkippingScene={skipScene.isPending}
                isStartingActivity={startScheduleBlock.isPending}
                isCompletingActivity={completeScheduleBlock.isPending}
                isSkippingActivity={skipScheduleBlock.isPending}
              />
            )}

            {/* Keep existing components: OT Projection, Timeline, AD Notes, etc. */}
            {/* ... */}
          </>
        )}
      </>
    )}
  </div>
);
```

### Step 5: Update CreateHotSetSessionModal

The modal should allow users to configure auto-start when creating a session:

```typescript
<CreateHotSetSessionModal
  // ... existing props
  defaultAutoStart={hotSetSettings?.auto_start_enabled ?? true}
  autoStartMinutes={hotSetSettings?.auto_start_minutes_before_call ?? 30}
/>
```

## Key Integration Points

### 1. Pre-Crew Call Flow
- Session auto-starts based on `auto_start_minutes_before_call` setting
- `PreCrewCallCountdown` shows countdown + prep checklist
- 1st AD clicks "Confirm Crew Call" → `crew_call_confirmed_at` timestamp
- 1st AD completes checklist, clicks "Confirm First Shot" → tracking begins

### 2. Dual Variance Display
- `ScheduleDeviationCard` now shows TWO metrics:
  - **Cumulative Variance**: Total time over/under from all completed items
  - **Real-Time Deviation**: Current position vs where schedule says we should be
- Backend calculates both in `calculate_projected_schedule()`

### 3. Tabbed Schedule View
- Replaces single scrolling `LiveScheduleView` with 3 tabs:
  - **Current & Upcoming**: Large current card + next 3 items
  - **Full Day Schedule**: All items with projected times
  - **Completed**: History with stats
- Default tab controlled by `default_schedule_view` setting

### 4. Settings Integration
- Settings panel toggles on/off with button
- Saves to database via `useUpdateHotSetSettings` hook
- Settings apply to all future sessions in the project

## Migration Notes

### Existing Sessions
- Sessions created before this update won't have auto-start data
- Can mark `crew_call_confirmed_at` = `started_at` for backward compat
- Real-time deviation will be 0 until backend recalculates

### Backward Compatibility
- All new props are optional with sensible defaults
- Existing components still work without new features
- Can roll out gradually (feature flag if needed)

## Testing Checklist

- [ ] Create new session with auto-start enabled
- [ ] Verify countdown displays correctly
- [ ] Confirm crew call (button click)
- [ ] Complete prep checklist
- [ ] Confirm first shot
- [ ] Verify dual variance displays correctly
- [ ] Test all 3 tabs in TabbedScheduleView
- [ ] Modify settings and verify they persist
- [ ] Test with existing session (backward compat)

## Next Steps (Optional Enhancements)

1. **Background Job**: Set up cron to run `HotSetSchedulerService.check_and_auto_start_sessions()` every minute
2. **WebSocket**: Push real-time notifications when sessions auto-start
3. **Enhanced Suggestions**: Implement backend logic for new suggestion types (Task #11)
4. **Grace Voting**: Add crew voting system for union sets
5. **Analytics**: Track which suggestions are most effective

## Files Modified

### Backend
- `/backend/database/migrations/059_hot_set_enhancements.sql`
- `/backend/app/api/hot_set.py`
- `/backend/app/services/hot_set_scheduler.py` (new)

### Frontend
- `/frontend/src/types/backlot.ts`
- `/frontend/src/hooks/backlot/useHotSet.ts`
- `/frontend/src/components/backlot/workspace/hot-set/PreCrewCallCountdown.tsx` (new)
- `/frontend/src/components/backlot/workspace/hot-set/TabbedScheduleView.tsx` (new)
- `/frontend/src/components/backlot/workspace/hot-set/HotSetSettingsPanel.tsx` (new)
- `/frontend/src/components/backlot/workspace/hot-set/ScheduleDeviationCard.tsx` (enhanced)
- `/frontend/src/components/backlot/workspace/hot-set/CatchUpSuggestionsPanel.tsx` (enhanced)
- `/frontend/src/components/backlot/workspace/hot-set/ScheduleItemRow.tsx` (enhanced)
- `/frontend/src/components/backlot/workspace/HotSetView.tsx` (integration needed)

## Database Migration

Run the migration:
```bash
node -e "
const { Client } = require('pg');
const fs = require('fs');
const sql = fs.readFileSync('database/migrations/059_hot_set_enhancements.sql', 'utf8');
const client = new Client({
  host: 'swn-database.c0vossgkunoa.us-east-1.rds.amazonaws.com',
  port: 5432, database: 'secondwatchnetwork',
  user: 'swn_admin', password: 'I6YvLh4FIUj2Wp40XeJ0mJVP',
  ssl: { rejectUnauthorized: false }
});
client.connect().then(() => client.query(sql)).then(() => console.log('Migration complete')).finally(() => client.end());
"
```
