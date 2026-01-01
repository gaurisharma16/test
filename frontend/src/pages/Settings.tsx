import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Settings as SettingsIcon,
  User,
  Bell,
  Shield,
  Palette,
  Save,
  Upload,
  Loader2,
  CheckCircle2,
  ServerCog,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import {
  adminApi,
  authApi,
  userSettingsApi,
  type AppSettings,
  type AppSettingsUpdate,
  type UserSettings,
} from "@/lib/api";

const LOG_LEVEL_OPTIONS = ["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"] as const;

const DIGEST_OPTIONS = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "never", label: "Never" },
] as const;

const LANGUAGE_OPTIONS = [
  { value: "en", label: "English" },
  { value: "es", label: "Spanish" },
  { value: "fr", label: "French" },
  { value: "de", label: "German" },
] as const;

const TIMEZONE_OPTIONS = [
  { value: "UTC", label: "UTC" },
  { value: "America/New_York", label: "America/New_York" },
  { value: "Europe/London", label: "Europe/London" },
  { value: "Asia/Kolkata", label: "Asia/Kolkata" },
  { value: "Asia/Tokyo", label: "Asia/Tokyo" },
] as const;

const THEME_OPTIONS = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "system", label: "System" },
] as const;

type AppSettingsFormState = {
  app_name: string;
  version: string;
  debug_mode: boolean;
  cache_enabled: boolean;
  log_level: string;
  max_upload_size_mb: number;
};

type UserSettingsFormState = {
  theme: string;
  notifications_enabled: boolean;
  email_digest_frequency: string;
  language: string;
  timezone: string;
};

const APP_SETTINGS_DEFAULT: AppSettingsFormState = {
  app_name: "",
  version: "",
  debug_mode: false,
  cache_enabled: true,
  log_level: "INFO",
  max_upload_size_mb: 50,
};

const USER_SETTINGS_DEFAULT: UserSettingsFormState = {
  theme: "dark",
  notifications_enabled: true,
  email_digest_frequency: "daily",
  language: "en",
  timezone: "UTC",
};

const normalizeAppSettings = (settings?: AppSettings | null): AppSettingsFormState => ({
  app_name: settings?.app_name ?? APP_SETTINGS_DEFAULT.app_name,
  version: settings?.version ?? APP_SETTINGS_DEFAULT.version,
  debug_mode: settings?.debug_mode ?? APP_SETTINGS_DEFAULT.debug_mode,
  cache_enabled: settings?.cache_enabled ?? APP_SETTINGS_DEFAULT.cache_enabled,
  log_level: settings?.log_level ?? APP_SETTINGS_DEFAULT.log_level,
  max_upload_size_mb:
    settings?.max_upload_size_mb ?? APP_SETTINGS_DEFAULT.max_upload_size_mb,
});

const normalizeUserSettings = (settings?: UserSettings | null): UserSettingsFormState => ({
  theme: settings?.theme ?? USER_SETTINGS_DEFAULT.theme,
  notifications_enabled:
    settings?.notifications_enabled ?? USER_SETTINGS_DEFAULT.notifications_enabled,
  email_digest_frequency:
    settings?.email_digest_frequency ?? USER_SETTINGS_DEFAULT.email_digest_frequency,
  language: settings?.language ?? USER_SETTINGS_DEFAULT.language,
  timezone: settings?.timezone ?? USER_SETTINGS_DEFAULT.timezone,
});

const getErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : "An unexpected error occurred";

export default function Settings() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [passwordForm, setPasswordForm] = useState({
    old_password: "",
    new_password: "",
    confirmPassword: "",
  });
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  const [appSettingsForm, setAppSettingsForm] = useState<AppSettingsFormState>(
    APP_SETTINGS_DEFAULT
  );
  const [appSettingsBaseline, setAppSettingsBaseline] =
    useState<AppSettingsFormState | null>(null);
  const [isLoadingAppSettings, setIsLoadingAppSettings] = useState(false);
  const [appSettingsError, setAppSettingsError] = useState<string | null>(null);
  const [isSavingAppSettings, setIsSavingAppSettings] = useState(false);

  const [userSettingsForm, setUserSettingsForm] = useState<UserSettingsFormState>(
    USER_SETTINGS_DEFAULT
  );
  const [userSettingsBaseline, setUserSettingsBaseline] =
    useState<UserSettingsFormState | null>(null);
  const [isLoadingUserSettings, setIsLoadingUserSettings] = useState(false);
  const [userSettingsError, setUserSettingsError] = useState<string | null>(null);
  const [isSavingNotifications, setIsSavingNotifications] = useState(false);
  const [isSavingPreferences, setIsSavingPreferences] = useState(false);
  const [isSavingAppearance, setIsSavingAppearance] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const loadSettings = async () => {
      setAppSettingsError(null);
      setUserSettingsError(null);
      setIsLoadingAppSettings(true);
      setIsLoadingUserSettings(true);

      try {
        const [appResult, userResult] = await Promise.allSettled([
          adminApi.getSettings(),
          userSettingsApi.getSettings(),
        ]);

        if (cancelled) {
          return;
        }

        if (appResult.status === "fulfilled") {
          const normalized = normalizeAppSettings(appResult.value.settings);
          setAppSettingsForm(normalized);
          setAppSettingsBaseline(normalized);
        } else {
          const message = getErrorMessage(appResult.reason as unknown);
          setAppSettingsError(message);
        }

        if (userResult.status === "fulfilled") {
          const normalized = normalizeUserSettings(userResult.value.settings);
          setUserSettingsForm(normalized);
          setUserSettingsBaseline(normalized);
        } else {
          const message = getErrorMessage(userResult.reason as unknown);
          setUserSettingsError(message);
        }
      } finally {
        if (!cancelled) {
          setIsLoadingAppSettings(false);
          setIsLoadingUserSettings(false);
        }
      }
    };

    loadSettings();

    return () => {
      cancelled = true;
    };
  }, []);

  const applyAppSettingsResponse = (settings: AppSettings) => {
    const normalized = normalizeAppSettings(settings);
    setAppSettingsForm(normalized);
    setAppSettingsBaseline(normalized);
  };

  const applyUserSettingsResponse = (settings: UserSettings) => {
    const normalized = normalizeUserSettings(settings);
    setUserSettingsForm(normalized);
    setUserSettingsBaseline(normalized);
  };

  const preferencesDirty =
    !!userSettingsBaseline &&
    (userSettingsForm.language !== userSettingsBaseline.language ||
      userSettingsForm.timezone !== userSettingsBaseline.timezone);

  const notificationsDirty =
    !!userSettingsBaseline &&
    (userSettingsForm.notifications_enabled !==
      userSettingsBaseline.notifications_enabled ||
      userSettingsForm.email_digest_frequency !==
        userSettingsBaseline.email_digest_frequency);

  const appearanceDirty =
    !!userSettingsBaseline &&
    userSettingsForm.theme !== userSettingsBaseline.theme;

  const appSettingsDirty =
    !!appSettingsBaseline &&
    (appSettingsForm.app_name !== appSettingsBaseline.app_name ||
      appSettingsForm.version !== appSettingsBaseline.version ||
      appSettingsForm.debug_mode !== appSettingsBaseline.debug_mode ||
      appSettingsForm.cache_enabled !== appSettingsBaseline.cache_enabled ||
      appSettingsForm.log_level !== appSettingsBaseline.log_level ||
      appSettingsForm.max_upload_size_mb !==
        appSettingsBaseline.max_upload_size_mb);

  const combinedSettingsError = [userSettingsError, appSettingsError]
    .filter((message): message is string => Boolean(message))
    .join(" ");

  const handleSaveAppSettings = async () => {
    if (!appSettingsBaseline) {
      toast({
        title: "Application settings unavailable",
        description: "Unable to save because settings are still loading.",
        variant: "destructive",
      });
      return;
    }

    const updates: AppSettingsUpdate = {};
    if (appSettingsForm.app_name !== appSettingsBaseline.app_name) {
      updates.app_name = appSettingsForm.app_name;
    }
    if (appSettingsForm.version !== appSettingsBaseline.version) {
      updates.version = appSettingsForm.version;
    }
    if (appSettingsForm.debug_mode !== appSettingsBaseline.debug_mode) {
      updates.debug_mode = appSettingsForm.debug_mode;
    }
    if (appSettingsForm.cache_enabled !== appSettingsBaseline.cache_enabled) {
      updates.cache_enabled = appSettingsForm.cache_enabled;
    }
    if (appSettingsForm.log_level !== appSettingsBaseline.log_level) {
      updates.log_level = appSettingsForm.log_level;
    }
    if (
      appSettingsForm.max_upload_size_mb !==
      appSettingsBaseline.max_upload_size_mb
    ) {
      updates.max_upload_size_mb = appSettingsForm.max_upload_size_mb;
    }

    if (Object.keys(updates).length === 0) {
      toast({
        title: "No changes detected",
        description: "Update a setting before saving.",
      });
      return;
    }

    setIsSavingAppSettings(true);
    setAppSettingsError(null);

    try {
      const response = await adminApi.updateSettings(updates);
      applyAppSettingsResponse(response.settings);
      toast({
        title: "Application settings updated",
        description: response.message ?? "Changes saved successfully.",
      });
    } catch (error) {
      const message = getErrorMessage(error);
      setAppSettingsError(message);
      toast({
        title: "Failed to update application settings",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsSavingAppSettings(false);
    }
  };

  const handleSavePreferences = async () => {
    if (!userSettingsBaseline) {
      toast({
        title: "Preferences unavailable",
        description: "User settings are still loading.",
        variant: "destructive",
      });
      return;
    }

    const updates: Partial<UserSettings> = {};
    if (userSettingsForm.language !== userSettingsBaseline.language) {
      updates.language = userSettingsForm.language;
    }
    if (userSettingsForm.timezone !== userSettingsBaseline.timezone) {
      updates.timezone = userSettingsForm.timezone;
    }

    if (Object.keys(updates).length === 0) {
      toast({
        title: "No changes detected",
        description: "Update your locale preferences before saving.",
      });
      return;
    }

    setIsSavingPreferences(true);
    setUserSettingsError(null);

    try {
      const response = await userSettingsApi.updateSettings(updates);
      applyUserSettingsResponse(response.settings);
      toast({
        title: "Preferences updated",
        description: response.message ?? "Locale preferences saved.",
      });
    } catch (error) {
      const message = getErrorMessage(error);
      setUserSettingsError(message);
      toast({
        title: "Failed to update preferences",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsSavingPreferences(false);
    }
  };

  const handleSaveNotifications = async () => {
    if (!userSettingsBaseline) {
      toast({
        title: "Preferences unavailable",
        description: "User settings are still loading.",
        variant: "destructive",
      });
      return;
    }

    const updates: Partial<UserSettings> = {};
    if (
      userSettingsForm.notifications_enabled !==
      userSettingsBaseline.notifications_enabled
    ) {
      updates.notifications_enabled = userSettingsForm.notifications_enabled;
    }
    if (
      userSettingsForm.email_digest_frequency !==
      userSettingsBaseline.email_digest_frequency
    ) {
      updates.email_digest_frequency =
        userSettingsForm.email_digest_frequency;
    }

    if (Object.keys(updates).length === 0) {
      toast({
        title: "No changes detected",
        description: "Update your notification preferences before saving.",
      });
      return;
    }

    setIsSavingNotifications(true);
    setUserSettingsError(null);

    try {
      const response = await userSettingsApi.updateSettings(updates);
      applyUserSettingsResponse(response.settings);
      toast({
        title: "Notification preferences updated",
        description:
          response.message ?? "Your notification settings were saved.",
      });
    } catch (error) {
      const message = getErrorMessage(error);
      setUserSettingsError(message);
      toast({
        title: "Failed to update notifications",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsSavingNotifications(false);
    }
  };

  const handleSaveAppearance = async () => {
    if (!userSettingsBaseline) {
      toast({
        title: "Preferences unavailable",
        description: "User settings are still loading.",
        variant: "destructive",
      });
      return;
    }

    if (userSettingsForm.theme === userSettingsBaseline.theme) {
      toast({
        title: "No changes detected",
        description: "Choose a different theme before saving.",
      });
      return;
    }

    setIsSavingAppearance(true);
    setUserSettingsError(null);

    try {
      const response = await userSettingsApi.updateSettings({
        theme: userSettingsForm.theme,
      });
      applyUserSettingsResponse(response.settings);
      toast({
        title: "Appearance updated",
        description: response.message ?? "Theme preference saved.",
      });
    } catch (error) {
      const message = getErrorMessage(error);
      setUserSettingsError(message);
      toast({
        title: "Failed to update appearance",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsSavingAppearance(false);
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError("");
    setPasswordSuccess(false);

    if (passwordForm.new_password !== passwordForm.confirmPassword) {
      setPasswordError("New passwords do not match");
      return;
    }

    if (passwordForm.new_password.length < 8) {
      setPasswordError("Password must be at least 8 characters long");
      return;
    }

    if (passwordForm.new_password.length > 72) {
      setPasswordError("Password cannot be longer than 72 characters");
      return;
    }

    setIsChangingPassword(true);

    try {
      await authApi.changePassword({
        old_password: passwordForm.old_password,
        new_password: passwordForm.new_password,
      });
      setPasswordSuccess(true);
      setPasswordForm({
        old_password: "",
        new_password: "",
        confirmPassword: "",
      });
    } catch (err: any) {
      setPasswordError(err.message || "Failed to change password");
    } finally {
      setIsChangingPassword(false);
    }
  };
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-foreground flex items-center space-x-2">
          <SettingsIcon className="h-8 w-8 text-primary" />
          <span>Settings</span>
        </h1>
        <p className="text-muted-foreground">
          Manage your account settings and preferences
        </p>
      </div>

      {combinedSettingsError && (
        <Alert variant="destructive">
          <AlertDescription>{combinedSettingsError}</AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="profile" className="space-y-4">
        <TabsList>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
          <TabsTrigger value="appearance">Appearance</TabsTrigger>
          <TabsTrigger value="application">Application</TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <User className="h-5 w-5" />
                <span>Profile Information</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">

              {/* Form Fields */}
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="username">Username</Label>
                  <Input id="username" value={user?.username ?? ""} readOnly />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" value={user?.email ?? ""} readOnly />
                  <p className="text-xs text-muted-foreground">
                    Email cannot be changed
                  </p>
                </div>
              </div>
              <div className="space-y-4 border-t pt-4">
                <h3 className="font-medium">Locale Preferences</h3>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="language">Language</Label>
                    <Select
                      value={userSettingsForm.language}
                      onValueChange={(value) =>
                        setUserSettingsForm((prev) => ({
                          ...prev,
                          language: value,
                        }))
                      }
                    >
                      <SelectTrigger
                        id="language"
                        disabled={isLoadingUserSettings || isSavingPreferences}
                      >
                        <SelectValue placeholder="Select language" />
                      </SelectTrigger>
                      <SelectContent>
                        {LANGUAGE_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="timezone">Timezone</Label>
                    <Select
                      value={userSettingsForm.timezone}
                      onValueChange={(value) =>
                        setUserSettingsForm((prev) => ({
                          ...prev,
                          timezone: value,
                        }))
                      }
                    >
                      <SelectTrigger
                        id="timezone"
                        disabled={isLoadingUserSettings || isSavingPreferences}
                      >
                        <SelectValue placeholder="Select timezone" />
                      </SelectTrigger>
                      <SelectContent>
                        {TIMEZONE_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Button
                  onClick={handleSavePreferences}
                  disabled={
                    isLoadingUserSettings ||
                    isSavingPreferences ||
                    !preferencesDirty
                  }
                >
                  {isSavingPreferences ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" />
                      Save Locale Preferences
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Bell className="h-5 w-5" />
                <span>Notification Preferences</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium">Email Notifications</h3>
                    <p className="text-sm text-muted-foreground">
                      Receive essential platform updates in your inbox
                    </p>
                  </div>
                  <Switch
                    id="email-notifications"
                    checked={userSettingsForm.notifications_enabled}
                    onCheckedChange={(checked) =>
                      setUserSettingsForm((prev) => ({
                        ...prev,
                        notifications_enabled: checked,
                      }))
                    }
                    disabled={isLoadingUserSettings || isSavingNotifications}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="digest-frequency">Email Digest Frequency</Label>
                  <Select
                    value={userSettingsForm.email_digest_frequency}
                    onValueChange={(value) =>
                      setUserSettingsForm((prev) => ({
                        ...prev,
                        email_digest_frequency: value,
                      }))
                    }
                  >
                    <SelectTrigger
                      id="digest-frequency"
                      disabled={isLoadingUserSettings || isSavingNotifications}
                    >
                      <SelectValue placeholder="Select frequency" />
                    </SelectTrigger>
                    <SelectContent>
                      {DIGEST_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Button
                onClick={handleSaveNotifications}
                disabled={
                  isLoadingUserSettings ||
                  isSavingNotifications ||
                  !notificationsDirty
                }
              >
                {isSavingNotifications ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Save Notification Settings
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Shield className="h-5 w-5" />
                <span>Security Settings</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div>
                  <h3 className="font-medium mb-3">Change Password</h3>
                  {passwordSuccess && (
                    <Alert className="mb-4 bg-green-50 border-green-200">
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                      <AlertDescription className="text-green-800">
                        Password changed successfully!
                      </AlertDescription>
                    </Alert>
                  )}
                  {passwordError && (
                    <Alert variant="destructive" className="mb-4">
                      <AlertDescription>{passwordError}</AlertDescription>
                    </Alert>
                  )}
                  <form onSubmit={handlePasswordChange} className="space-y-3">
                    <div className="space-y-2">
                      <Label htmlFor="currentPassword">Current Password</Label>
                      <Input 
                        id="currentPassword" 
                        type="password"
                        value={passwordForm.old_password}
                        onChange={(e) => setPasswordForm({...passwordForm, old_password: e.target.value})}
                        required
                        disabled={isChangingPassword}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="newPassword">New Password</Label>
                      <Input 
                        id="newPassword" 
                        type="password"
                        value={passwordForm.new_password}
                        onChange={(e) => setPasswordForm({...passwordForm, new_password: e.target.value})}
                        required
                        disabled={isChangingPassword}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="confirmPassword">Confirm New Password</Label>
                      <Input 
                        id="confirmPassword" 
                        type="password"
                        value={passwordForm.confirmPassword}
                        onChange={(e) => setPasswordForm({...passwordForm, confirmPassword: e.target.value})}
                        required
                        disabled={isChangingPassword}
                      />
                    </div>
                    <Button type="submit" size="sm" disabled={isChangingPassword}>
                      {isChangingPassword ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Updating...
                        </>
                      ) : (
                        "Update Password"
                      )}
                    </Button>
                  </form>
                </div>


                <div className="pt-4 border-t">
                  <h3 className="font-medium mb-3">Data & Privacy</h3>
                  <div className="space-y-3">
                    <Button variant="outline" size="sm">Download My Data</Button>
                    <Button variant="destructive" size="sm">Delete Account</Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="appearance">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Palette className="h-5 w-5" />
                <span>Appearance Settings</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-3">
                <Label htmlFor="theme">Theme</Label>
                <Select
                  value={userSettingsForm.theme}
                  onValueChange={(value) =>
                    setUserSettingsForm((prev) => ({
                      ...prev,
                      theme: value,
                    }))
                  }
                >
                  <SelectTrigger
                    id="theme"
                    disabled={isLoadingUserSettings || isSavingAppearance}
                  >
                    <SelectValue placeholder="Select theme" />
                  </SelectTrigger>
                  <SelectContent>
                    {THEME_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Button
                onClick={handleSaveAppearance}
                disabled={
                  isLoadingUserSettings ||
                  isSavingAppearance ||
                  !appearanceDirty
                }
              >
                {isSavingAppearance ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Save Appearance
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="application">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <ServerCog className="h-5 w-5" />
                <span>Application Settings</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="appName">Application Name</Label>
                  <Input
                    id="appName"
                    value={appSettingsForm.app_name}
                    onChange={(event) =>
                      setAppSettingsForm((prev) => ({
                        ...prev,
                        app_name: event.target.value,
                      }))
                    }
                    disabled={isLoadingAppSettings || isSavingAppSettings}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="appVersion">Version</Label>
                  <Input
                    id="appVersion"
                    value={appSettingsForm.version}
                    onChange={(event) =>
                      setAppSettingsForm((prev) => ({
                        ...prev,
                        version: event.target.value,
                      }))
                    }
                    disabled={isLoadingAppSettings || isSavingAppSettings}
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="logLevel">Log Level</Label>
                  <Select
                    value={appSettingsForm.log_level}
                    onValueChange={(value) =>
                      setAppSettingsForm((prev) => ({
                        ...prev,
                        log_level: value,
                      }))
                    }
                  >
                    <SelectTrigger
                      id="logLevel"
                      disabled={isLoadingAppSettings || isSavingAppSettings}
                    >
                      <SelectValue placeholder="Select log level" />
                    </SelectTrigger>
                    <SelectContent>
                      {LOG_LEVEL_OPTIONS.map((option) => (
                        <SelectItem key={option} value={option}>
                          {option}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="uploadLimit">Max Upload Size (MB)</Label>
                  <Input
                    id="uploadLimit"
                    type="number"
                    min={1}
                    value={appSettingsForm.max_upload_size_mb}
                    onChange={(event) => {
                      const parsed = parseInt(event.target.value, 10);
                      setAppSettingsForm((prev) => ({
                        ...prev,
                        max_upload_size_mb: Number.isNaN(parsed)
                          ? prev.max_upload_size_mb
                          : Math.max(1, parsed),
                      }));
                    }}
                    disabled={isLoadingAppSettings || isSavingAppSettings}
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <Label htmlFor="debugMode" className="font-medium">
                      Debug Mode
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Enable verbose logging and debugging helpers
                    </p>
                  </div>
                  <Switch
                    id="debugMode"
                    checked={appSettingsForm.debug_mode}
                    onCheckedChange={(checked) =>
                      setAppSettingsForm((prev) => ({
                        ...prev,
                        debug_mode: checked,
                      }))
                    }
                    disabled={isLoadingAppSettings || isSavingAppSettings}
                  />
                </div>
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <Label htmlFor="cacheEnabled" className="font-medium">
                      Cache Enabled
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Cache expensive computations for faster responses
                    </p>
                  </div>
                  <Switch
                    id="cacheEnabled"
                    checked={appSettingsForm.cache_enabled}
                    onCheckedChange={(checked) =>
                      setAppSettingsForm((prev) => ({
                        ...prev,
                        cache_enabled: checked,
                      }))
                    }
                    disabled={isLoadingAppSettings || isSavingAppSettings}
                  />
                </div>
              </div>

              <Button
                onClick={handleSaveAppSettings}
                disabled={
                  isLoadingAppSettings ||
                  isSavingAppSettings ||
                  !appSettingsDirty
                }
              >
                {isSavingAppSettings ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Save Application Settings
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}