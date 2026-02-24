import { zodResolver } from "@hookform/resolvers/zod";
import { useFieldArray, useForm } from "react-hook-form";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { departments, filmmakerSkills, experienceLevels, filmPositions, availableForOptions, contactMethods } from "@/data/filmmaker-options";
import { MultiSelect } from "../ui/multi-select";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { Loader2, PlusCircle, Trash2 } from "lucide-react";
import { useFormDraftRHF } from '@/hooks/useFormDraftRHF';
import { buildDraftKey } from '@/lib/formDraftStorage';
import { Switch } from "../ui/switch";
import { Checkbox } from "../ui/checkbox";
import { TagInput } from "../ui/tag-input";
import { AvatarUploader } from '../account/AvatarUploader';
import { useQueryClient } from "@tanstack/react-query";
import { LocationAutocomplete, LocationData } from '@/components/ui/location-autocomplete';

const creditSchema = z.object({
  position: z.string().min(1, "Position is required."),
  productionTitle: z.string().min(1, "Production title is required."),
  description: z.string().max(250, "Description must be 250 characters or less.").optional(),
  productionDate: z.string().optional(),
});

const onboardingSchema = z.object({
  fullName: z.string().min(2, "Full name is required."),
  displayName: z.string().optional(),
  location: z.string().optional(),
  location_visible: z.boolean().default(true),
  portfolio_website: z.string().url("Please enter a valid URL.").optional().or(z.literal('')),
  reel_links: z.array(z.object({ value: z.string().url({ message: "Please enter a valid URL." }).or(z.literal('')) })).optional(),
  bio: z.string().max(500, "Bio cannot exceed 500 characters.").optional(),
  department: z.string().min(1, "Please select a primary department."),
  skills: z.array(z.string()).min(1, "Please select at least one skill."),
  experienceLevel: z.enum(["Entry-Level", "Mid-Level", "Senior", "Department Head"], {
    required_error: "You need to select an experience level.",
  }),
  credits: z.array(creditSchema).optional(),
  accepting_work: z.boolean().default(false),
  available_for: z.array(z.string()).optional(),
  preferred_locations: z.array(z.string()).optional(),
  contact_method: z.string().min(1, "Please select a contact method."),
  show_email: z.boolean().default(false),
});

type OnboardingFormValues = z.infer<typeof onboardingSchema>;
type CreditFormValues = z.infer<typeof creditSchema>;

const AddCreditForm = ({ onAddCredit, closeModal }: { onAddCredit: (data: CreditFormValues) => void, closeModal: () => void }) => {
    const form = useForm<CreditFormValues>({
        resolver: zodResolver(creditSchema),
        defaultValues: { position: "", productionTitle: "", description: "", productionDate: "" },
    });

    function onSubmit(data: CreditFormValues) {
        onAddCredit(data);
        closeModal();
    }

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField control={form.control} name="position" render={({ field }) => (
                    <FormItem><FormLabel>Position</FormLabel><FormControl><Input placeholder="e.g. Director" {...field} list="positions" /></FormControl><datalist id="positions">{filmPositions.map(p => <option key={p} value={p} />)}</datalist><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="productionTitle" render={({ field }) => (
                    <FormItem><FormLabel>Production Title</FormLabel><FormControl><Input placeholder="e.g. My Awesome Film" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="productionDate" render={({ field }) => (
                    <FormItem><FormLabel>Production Date (Optional)</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="description" render={({ field }) => (
                    <FormItem><FormLabel>Description (Optional)</FormLabel><FormControl><Textarea placeholder="A short description of your role or the project." {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <Button type="submit">Add Credit</Button>
            </form>
        </Form>
    )
}

const FilmmakerOnboardingForm = () => {
  const { profileId, session } = useAuth();
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCreditModalOpen, setIsCreditModalOpen] = useState(false);
  const queryClient = useQueryClient();

  const form = useForm<OnboardingFormValues>({
    resolver: zodResolver(onboardingSchema),
    defaultValues: {
      fullName: "",
      displayName: "",
      location: "",
      location_visible: true,
      portfolio_website: "",
      reel_links: [],
      bio: "",
      skills: [],
      credits: [],
      accepting_work: false,
      available_for: [],
      preferred_locations: [],
      show_email: false,
    },
  });

  const { clearDraft } = useFormDraftRHF(form, {
    key: buildDraftKey('profile', 'filmmaker-onboard', 'new'),
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "credits"
  });

  const { fields: reelFields, append: appendReel, remove: removeReel } = useFieldArray({
    control: form.control,
    name: "reel_links"
  });

  async function onSubmit(data: OnboardingFormValues) {
    if (!profileId) {
      toast.error("You must be logged in to create a profile.");
      return;
    }
    setIsSubmitting(true);

    try {
      await api.onboardFilmmaker({
        full_name: data.fullName,
        display_name: data.displayName,
        bio: data.bio,
        reel_links: data.reel_links?.map(link => link.value).filter(Boolean) as string[],
        portfolio_website: data.portfolio_website,
        location: data.location,
        location_visible: data.location_visible,
        department: data.department,
        experience_level: data.experienceLevel,
        skills: data.skills,
        credits: data.credits,
        accepting_work: data.accepting_work,
        available_for: data.available_for,
        preferred_locations: data.preferred_locations,
        contact_method: data.contact_method,
        show_email: data.show_email,
      });

      clearDraft();
      toast.success("Profile created successfully!");
      // Invalidate profile queries to refresh data
      await queryClient.invalidateQueries({ queryKey: ['filmmaker_profile', profileId] });
      await queryClient.invalidateQueries({ queryKey: ['profile', profileId] });
      // Navigate to success page
      navigate("/filmmaker-onboarding/success");
    } catch (error: any) {
      console.error("Onboarding error:", error);
      toast.error("Failed to save profile: " + error.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        {/* Section 1: Basic Info */}
        <Card className="bg-charcoal-black/50 border-muted-gray/20">
          <CardHeader><CardTitle className="font-heading text-2xl text-bone-white">Basic Info</CardTitle></CardHeader>
          <CardContent className="space-y-6">
            <div className="flex flex-col md:flex-row items-center gap-6">
                <AvatarUploader
                  avatarUrl={session?.user?.user_metadata?.avatar_url}
                  onUploadSuccess={(newAvatarUrl) => {
                    const patchAvatar = (old: any) =>
                      old ? { ...old, avatar_url: newAvatarUrl } : { avatar_url: newAvatarUrl };
                    queryClient.setQueryData(['profile', session?.user?.id], patchAvatar);
                    queryClient.setQueryData(['account-profile', session?.user?.id], patchAvatar);
                    try {
                      const cachedRaw = localStorage.getItem('swn_cached_profile');
                      if (cachedRaw) {
                        const cached = JSON.parse(cachedRaw);
                        cached.avatar_url = newAvatarUrl;
                        localStorage.setItem('swn_cached_profile', JSON.stringify(cached));
                      }
                    } catch { /* ignore */ }
                  }}
                />
                <div className="flex-1 w-full space-y-6">
                  <FormField control={form.control} name="fullName" render={({ field }) => (
                      <FormItem><FormLabel>Full Name</FormLabel><FormDescription>Your legal name, shown on your public profile.</FormDescription><FormControl><Input placeholder="e.g. Jane Doe" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="displayName" render={({ field }) => (
                      <FormItem><FormLabel>Display Name (Optional)</FormLabel><FormDescription>An alias or preferred name for forums and comments.</FormDescription><FormControl><Input placeholder="e.g. JDoe" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField control={form.control} name="location" render={({ field }) => (
                  <FormItem>
                    <FormLabel>City & State</FormLabel>
                    <FormControl>
                      <LocationAutocomplete
                        value={field.value || ''}
                        onChange={(locationData: LocationData) => {
                          // In city mode, displayName is already "City, State" format
                          field.onChange(locationData.displayName);
                        }}
                        showUseMyLocation={true}
                        placeholder="Start typing a city..."
                        mode="city"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
              )} />
              <FormField control={form.control} name="location_visible" render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border border-muted-gray/20 p-4">
                      <div className="space-y-0.5"><FormLabel>Show Location on Profile?</FormLabel></div>
                      <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                  </FormItem>
              )} />
            </div>
            <FormField control={form.control} name="portfolio_website" render={({ field }) => (
                <FormItem><FormLabel>Personal Website</FormLabel><FormControl><Input placeholder="https://your-portfolio.com" {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            <FormField control={form.control} name="bio" render={({ field }) => (
                <FormItem><FormLabel>Bio / About Me</FormLabel><FormControl><Textarea placeholder="Tell us a little bit about yourself" className="resize-y" {...field} /></FormControl><FormDescription>{form.watch('bio')?.length || 0}/500 characters</FormDescription><FormMessage /></FormItem>
            )} />
          </CardContent>
        </Card>

        {/* Section: Reels */}
        <Card className="bg-charcoal-black/50 border-muted-gray/20">
            <CardHeader>
                <CardTitle className="font-heading text-2xl text-bone-white">Reels / Demos</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                {reelFields.map((field, index) => (
                    <FormField
                        key={field.id}
                        control={form.control}
                        name={`reel_links.${index}.value`}
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel className="sr-only">Reel Link {index + 1}</FormLabel>
                                <div className="flex items-center gap-2">
                                    <FormControl>
                                        <Input placeholder="https://vimeo.com/your-reel" {...field} />
                                    </FormControl>
                                    <Button type="button" variant="ghost" size="icon" onClick={() => removeReel(index)}>
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                ))}
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => appendReel({ value: "" })}
                >
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Add Reel Link
                </Button>
            </CardContent>
        </Card>

        {/* Section 2: Skills & Departments */}
        <Card className="bg-charcoal-black/50 border-muted-gray/20">
          <CardHeader><CardTitle className="font-heading text-2xl text-bone-white">Skills & Departments</CardTitle></CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField control={form.control} name="department" render={({ field }) => (
                    <FormItem><FormLabel>Primary Department</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select a department" /></SelectTrigger></FormControl><SelectContent>{departments.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="experienceLevel" render={({ field }) => (
                    <FormItem><FormLabel>Experience Level</FormLabel><FormControl><RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="flex items-center space-x-4 pt-2">{experienceLevels.map(level => (<FormItem key={level} className="flex items-center space-x-2 space-y-0"><FormControl><RadioGroupItem value={level} /></FormControl><FormLabel className="font-normal">{level}</FormLabel></FormItem>))}</RadioGroup></FormControl><FormMessage /></FormItem>
                )} />
            </div>
            <FormField control={form.control} name="skills" render={({ field }) => (
                <FormItem><FormLabel>Skills</FormLabel><FormControl><MultiSelect options={filmmakerSkills.map(skill => ({ value: skill, label: skill }))} selected={field.value} onChange={field.onChange} placeholder="Select your skills..." /></FormControl><FormDescription>Select all that apply. You can type to search.</FormDescription><FormMessage /></FormItem>
            )} />
          </CardContent>
        </Card>

        {/* Section 3: Credits */}
        <Card className="bg-charcoal-black/50 border-muted-gray/20">
            <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="font-heading text-2xl text-bone-white">Credits</CardTitle>
                <Dialog open={isCreditModalOpen} onOpenChange={setIsCreditModalOpen}>
                    <DialogTrigger asChild>
                        <Button type="button" variant="outline" size="sm"><PlusCircle className="mr-2 h-4 w-4" /> Add Credit</Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader><DialogTitle>Add a New Credit</DialogTitle></DialogHeader>
                        <AddCreditForm onAddCredit={(data) => append(data)} closeModal={() => setIsCreditModalOpen(false)} />
                    </DialogContent>
                </Dialog>
            </CardHeader>
            <CardContent>
                {fields.length === 0 ? (
                    <p className="text-muted-gray text-sm">No credits added yet. Click "Add Credit" to get started.</p>
                ) : (
                    <ul className="space-y-4">
                        {fields.map((field, index) => (
                            <li key={field.id} className="flex items-center justify-between p-3 bg-charcoal-black rounded-md">
                                <div>
                                    <p className="font-semibold">{field.position}</p>
                                    <p className="text-sm text-muted-gray">{field.productionTitle}</p>
                                </div>
                                <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)}>
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </li>
                        ))}
                    </ul>
                )}
            </CardContent>
        </Card>

        {/* Section 4: Availability & Contact */}
        <Card className="bg-charcoal-black/50 border-muted-gray/20">
            <CardHeader><CardTitle className="font-heading text-2xl text-bone-white">Availability & Contact</CardTitle></CardHeader>
            <CardContent className="space-y-6">
                <FormField control={form.control} name="accepting_work" render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border border-muted-gray/20 p-4">
                        <div className="space-y-0.5"><FormLabel>Currently Accepting Work?</FormLabel><FormDescription>Set your status to let others know if you're available for new projects.</FormDescription></div>
                        <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                    </FormItem>
                )} />
                <FormField control={form.control} name="available_for" render={({ field }) => (
                    <FormItem><FormLabel>Available For</FormLabel><div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-2">{availableForOptions.map((item) => (
                        <FormField key={item.id} control={form.control} name="available_for" render={({ field }) => {
                            return (<FormItem key={item.id} className="flex flex-row items-start space-x-3 space-y-0"><FormControl><Checkbox checked={field.value?.includes(item.label)} onCheckedChange={(checked) => {
                                return checked ? field.onChange([...(field.value || []), item.label]) : field.onChange(field.value?.filter((value) => value !== item.label))
                            }} /></FormControl><FormLabel className="font-normal">{item.label}</FormLabel></FormItem>)
                        }}/>
                    ))}</div><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="preferred_locations" render={({ field }) => (
                    <FormItem><FormLabel>Preferred Work Locations</FormLabel><FormControl><TagInput {...field} placeholder="Type a location and press Enter..." /></FormControl><FormDescription>Add cities or regions where you'd like to work.</FormDescription><FormMessage /></FormItem>
                )} />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField control={form.control} name="contact_method" render={({ field }) => (
                        <FormItem><FormLabel>Preferred Contact Method</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select a method" /></SelectTrigger></FormControl><SelectContent>{contactMethods.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>
                    )} />
                    <FormField
                      control={form.control}
                      name="show_email"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-start space-x-3 rounded-lg border border-muted-gray/20 p-4">
                          <FormControl>
                            <Checkbox
                              checked={field.value}
                              onCheckedChange={field.onChange}
                              id="show_email"
                            />
                          </FormControl>
                          <div className="grid gap-1.5 leading-none">
                            <label
                              htmlFor="show_email"
                              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                            >
                              Show Email on Profile?
                            </label>
                            <FormDescription>
                                If checked, your email will be visible on your public filmmaker profile.
                            </FormDescription>
                          </div>
                        </FormItem>
                      )}
                    />
                </div>
            </CardContent>
        </Card>

        <div className="flex justify-end">
            <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Complete My Profile
            </Button>
        </div>
      </form>
    </Form>
  );
};

export default FilmmakerOnboardingForm;