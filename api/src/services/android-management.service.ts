import { google } from 'googleapis';
import fs from 'fs';

interface SignupUrlData {
  name: string;
  url: string;
}

interface EnterpriseData {
  name: string;
  enterpriseDisplayName?: string;
}

interface PolicyOptions {
  passwordMinLength?: number;
  passwordQuality?: string;
  wifiSsid?: string;
  wifiSecurity?: string;
  wifiPassword?: string;
  cameraDisabled?: boolean;
  screenCaptureDisabled?: boolean;
  applications?: Array<{
    packageName: string;
    installType: string;
    defaultPermissionPolicy?: string;
  }>;
  blockedPackageNames?: string[];
  kioskPackageName?: string;
}

interface EnrollmentTokenData {
  name: string;
  value: string;
  qrCode?: string;
  duration: string;
  policyName: string;
}

interface DeviceData {
  name: string;
  state: string;
  hardwareInfo?: any;
  softwareInfo?: any;
  memoryInfo?: any;
  networkInfo?: any;
  policyName?: string;
  lastStatusReportTime?: string;
}

export class AndroidManagementService {
  private client: any;
  private projectId: string;

  constructor(serviceAccountPath: string, projectId: string) {
    if (!fs.existsSync(serviceAccountPath)) {
      throw new Error(`Service account file not found: ${serviceAccountPath}`);
    }

    this.projectId = projectId;

    const auth = new google.auth.GoogleAuth({
      keyFile: serviceAccountPath,
      scopes: ['https://www.googleapis.com/auth/androidmanagement']
    });

    this.client = google.androidmanagement({
      version: 'v1',
      auth: auth
    });

  }

  async createSignupUrl(callbackUrl: string = 'https://localhost'): Promise<SignupUrlData | null> {
    try {
      const response = await this.client.signupUrls.create({
        projectId: this.projectId,
        requestBody: {
          callbackUrl
        }
      });

      return response.data;
    } catch (error: any) {
      console.error('Error creating signup URL:', error.message);
      return null;
    }
  }

  async completeEnterpriseRegistration(
    enterpriseToken: string,
    signupUrlName: string
  ): Promise<EnterpriseData | null> {
    try {
      const response = await this.client.enterprises.create({
        projectId: this.projectId,
        enterpriseToken: enterpriseToken,
        signupUrlName: signupUrlName
      });

      return response.data;
    } catch (error: any) {
      console.error('Error completing enterprise registration:', error.message);
      return null;
    }
  }

  async getEnterprise(enterpriseName: string): Promise<EnterpriseData | null> {
    try {
      const response = await this.client.enterprises.get({
        name: enterpriseName
      });
      return response.data;
    } catch (error: any) {
      console.error('Error getting enterprise:', error.message);
      return null;
    }
  }

  async createPolicy(
    enterpriseName: string,
    policyId: string,
    options: PolicyOptions = {}
  ): Promise<any> {
    const policy: any = {
      applications: [
        {
          packageName: 'com.google.android.apps.work.clouddpc',
          installType: 'FORCE_INSTALLED',
          defaultPermissionPolicy: 'GRANT'
        }
      ],
      statusReportingSettings: {
        applicationReportsEnabled: true,
        deviceSettingsEnabled: true,
        softwareInfoEnabled: true,
        memoryInfoEnabled: true,
        networkInfoEnabled: true,
        displayInfoEnabled: true,
        powerManagementEventsEnabled: true,
        hardwareStatusEnabled: true,
        systemPropertiesEnabled: true
      }
    };

    if (options.passwordMinLength) {
      policy.passwordPolicies = [{
        passwordMinimumLength: options.passwordMinLength,
        passwordQuality: options.passwordQuality || 'NUMERIC'
      }];
    }

    if (options.wifiSsid) {
      policy.openNetworkConfiguration = {
        networkConfigurations: [{
          ssid: options.wifiSsid,
          wifiSecurityType: options.wifiSecurity || 'WPA_PSK',
          password: options.wifiPassword || ''
        }]
      };
    }

    if (options.applications && Array.isArray(options.applications)) {
      policy.applications.push(...options.applications);
    }
    if (options.blockedPackageNames && options.blockedPackageNames.length > 0) {
      for (const pkg of options.blockedPackageNames) {
        if (pkg && !policy.applications.some((a: any) => a.packageName === pkg)) {
          policy.applications.push({
            packageName: pkg,
            installType: 'BLOCKED',
            defaultPermissionPolicy: 'PROMPT'
          });
        }
      }
    }
    if (options.kioskPackageName) {
      const exists = policy.applications.some((a: any) => a.packageName === options.kioskPackageName);
      if (!exists) {
        policy.applications.push({
          packageName: options.kioskPackageName,
          installType: 'KIOSK',
          defaultPermissionPolicy: 'GRANT'
        });
      }
    }

    if (options.cameraDisabled === true) {
      policy.cameraDisabled = true;
    }
    if (options.screenCaptureDisabled === true) {
      policy.screenCaptureDisabled = true;
    }

    try {
      const policyName = `${enterpriseName}/policies/${policyId}`;

      const response = await this.client.enterprises.policies.patch({
        name: policyName,
        requestBody: policy
      });

      return response.data;
    } catch (error: any) {
      console.error('Error creating policy:', error.message);
      return null;
    }
  }

  async createEnrollmentToken(
    enterpriseName: string,
    policyId: string,
    durationSeconds: number = 3600
  ): Promise<EnrollmentTokenData | null> {
    const enrollmentToken = {
      policyName: `${enterpriseName}/policies/${policyId}`,
      duration: `${durationSeconds}s`
    };

    try {
      const response = await this.client.enterprises.enrollmentTokens.create({
        parent: enterpriseName,
        requestBody: enrollmentToken
      });

      return response.data;
    } catch (error: any) {
      console.error('Error creating enrollment token:', error.message);
      return null;
    }
  }

  async listDevices(enterpriseName: string): Promise<DeviceData[]> {
    try {
      const response = await this.client.enterprises.devices.list({
        parent: enterpriseName
      });

      return response.data.devices || [];
    } catch (error: any) {
      console.error('Error listing devices:', error.message);
      return [];
    }
  }

  async getDevice(deviceName: string): Promise<DeviceData | null> {
    try {
      const response = await this.client.enterprises.devices.get({
        name: deviceName
      });
      return response.data;
    } catch (error: any) {
      console.error('Error getting device:', error.message);
      return null;
    }
  }

  /**
   * Envia comando ao dispositivo via Android Management API.
   * @see https://developers.google.com/android/management/reference/rest/v1/enterprises.devices/issueCommand
   */
  async issueCommand(
    deviceName: string,
    commandType: 'LOCK' | 'REBOOT' | 'RESET_PASSWORD',
    options: { newPassword?: string; flags?: string[]; durationSeconds?: number } = {}
  ): Promise<any> {
    const command: any = { type: commandType };

    if (options.durationSeconds != null && options.durationSeconds > 0) {
      command.duration = `${options.durationSeconds}s`;
    }

    if (commandType === 'RESET_PASSWORD') {
      if (options.newPassword) {
        const pwd = String(options.newPassword);
        if (pwd.length < 6) {
          console.error('RESET_PASSWORD: newPassword must be at least 6 characters (Android 14+)');
          return null;
        }
        command.newPassword = pwd;
      }
      command.resetPasswordFlags = options.flags && options.flags.length
        ? options.flags
        : ['REQUIRE_ENTRY'];
    }

    try {
      const response = await this.client.enterprises.devices.issueCommand({
        name: deviceName,
        requestBody: command
      });

      return response.data;
    } catch (error: any) {
      console.error('Error issuing command:', error.message);
      return null;
    }
  }

  async deleteDevice(deviceName: string): Promise<boolean> {
    try {
      await this.client.enterprises.devices.delete({
        name: deviceName
      });

      return true;
    } catch (error: any) {
      console.error('Error deleting device:', error.message);
      return false;
    }
  }
}

export default AndroidManagementService;
