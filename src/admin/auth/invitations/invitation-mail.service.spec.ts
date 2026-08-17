import { Logger } from '@nestjs/common';
import { Resend } from 'resend';

import { InvitationMailService } from './invitation-mail.service';

jest.mock('resend', () => ({
  Resend: jest.fn(),
}));

interface MockEmailPayload {
  from: string;
  to: string[];
  subject: string;
  text: string;
  html: string;
}

interface MockEmailOptions {
  idempotencyKey: string;
}

interface MockEmailResponse {
  data: {
    id: string;
  } | null;
  error: {
    message: string;
  } | null;
}

describe('InvitationMailService', () => {
  const originalEnv = { ...process.env };

  const resendSendMock = jest.fn<
    Promise<MockEmailResponse>,
    [MockEmailPayload, MockEmailOptions]
  >();
  const resendConstructorMock = Resend as jest.MockedClass<typeof Resend>;

  let service: InvitationMailService;

  const params = {
    email: 'student@connect.ust.hk',
    name: 'Test Student',
    invitationUrl: 'http://localhost:3000/signup/invitation?token=test-token',
    expiresAt: new Date('2026-08-13T00:00:00.000Z'),
    idempotencyKey: 'invitation/test-invitation-id',
  };

  beforeEach(() => {
    jest.resetAllMocks();

    process.env = {
      ...originalEnv,
    };

    service = new InvitationMailService();

    resendConstructorMock.mockImplementation(
      () =>
        ({
          emails: {
            send: resendSendMock,
          },
        }) as unknown as Resend,
    );
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('should send an invitation using mock mode by default', async () => {
    process.env.NODE_ENV = 'test';

    delete process.env.INVITATION_MAIL_MODE;
    delete process.env.INVITATION_MOCK_FAILURE_EMAILS;

    const result = await service.sendInvitationEmail(params);

    expect(result.providerMessageId.startsWith('mock-')).toBe(true);

    expect(resendConstructorMock).not.toHaveBeenCalled();
    expect(resendSendMock).not.toHaveBeenCalled();
  });

  it('should simulate a mock email failure', async () => {
    process.env.INVITATION_MAIL_MODE = 'mock';
    process.env.INVITATION_MOCK_FAILURE_EMAILS = 'student@connect.ust.hk';

    await expect(service.sendInvitationEmail(params)).rejects.toThrow(
      'Mock invitation email sending failed',
    );

    expect(resendConstructorMock).not.toHaveBeenCalled();
  });

  it('should reject mock mode outside development and test environments', async () => {
    process.env.NODE_ENV = 'production';
    process.env.INVITATION_MAIL_MODE = 'mock';

    await expect(service.sendInvitationEmail(params)).rejects.toThrow(
      'Mock invitation mail mode is only allowed in development or test environments',
    );

    expect(resendConstructorMock).not.toHaveBeenCalled();
    expect(resendSendMock).not.toHaveBeenCalled();
  });

  it('should log the invitation URL only when explicitly enabled in development', async () => {
    process.env.NODE_ENV = 'development';
    process.env.INVITATION_MAIL_MODE = 'mock';
    process.env.INVITATION_MOCK_LOG_URL = 'true';

    const warnSpy = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);

    await service.sendInvitationEmail(params);

    expect(warnSpy).toHaveBeenCalledWith(
      `[LOCAL MOCK ONLY] Invitation URL (${params.idempotencyKey}): ${params.invitationUrl}`,
    );

    warnSpy.mockRestore();
  });

  it('should not log the invitation URL outside development even when explicitly enabled', async () => {
    process.env.NODE_ENV = 'test';
    process.env.INVITATION_MAIL_MODE = 'mock';
    process.env.INVITATION_MOCK_LOG_URL = 'true';

    const warnSpy = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);

    await service.sendInvitationEmail(params);

    expect(warnSpy).not.toHaveBeenCalled();

    warnSpy.mockRestore();
  });

  it('should reject an unsupported mail mode', async () => {
    process.env.INVITATION_MAIL_MODE = 'smtp';

    await expect(service.sendInvitationEmail(params)).rejects.toThrow(
      'Unsupported invitation mail mode: smtp',
    );
  });

  it('should reject resend mode when the API key is missing', async () => {
    process.env.INVITATION_MAIL_MODE = 'resend';
    delete process.env.RESEND_API_KEY;
    process.env.INVITATION_FROM_EMAIL = 'KSA <no-reply@hkustksa.org>';

    await expect(service.sendInvitationEmail(params)).rejects.toThrow(
      'RESEND_API_KEY is not configured',
    );

    expect(resendConstructorMock).not.toHaveBeenCalled();
  });

  it('should reject resend mode when the sender is missing', async () => {
    process.env.INVITATION_MAIL_MODE = 'resend';
    process.env.RESEND_API_KEY = 're_test';
    delete process.env.INVITATION_FROM_EMAIL;

    await expect(service.sendInvitationEmail(params)).rejects.toThrow(
      'INVITATION_FROM_EMAIL is not configured',
    );

    expect(resendConstructorMock).not.toHaveBeenCalled();
  });

  it('should send an invitation through Resend and return the provider message ID', async () => {
    process.env.INVITATION_MAIL_MODE = 'resend';
    process.env.RESEND_API_KEY = 're_test';
    process.env.INVITATION_FROM_EMAIL = 'KSA <no-reply@hkustksa.org>';

    let capturedPayload: MockEmailPayload | undefined;
    let capturedOptions: MockEmailOptions | undefined;

    resendSendMock.mockImplementation((payload, options) => {
      capturedPayload = payload;
      capturedOptions = options;

      return Promise.resolve({
        data: {
          id: 'email-test-id',
        },
        error: null,
      });
    });

    const result = await service.sendInvitationEmail(params);

    expect(result).toEqual({
      providerMessageId: 'email-test-id',
    });

    expect(resendConstructorMock).toHaveBeenCalledTimes(1);
    expect(resendConstructorMock).toHaveBeenCalledWith('re_test');

    expect(resendSendMock).toHaveBeenCalledTimes(1);

    expect(capturedPayload).toBeDefined();
    expect(capturedOptions).toBeDefined();

    if (!capturedPayload || !capturedOptions) {
      throw new Error('Expected Resend email arguments to be captured');
    }

    expect(capturedPayload.from).toBe('KSA <no-reply@hkustksa.org>');

    expect(capturedPayload.to).toEqual(['student@connect.ust.hk']);

    expect(capturedPayload.subject).toBe(
      '[HKUST KSA] Complete your account registration',
    );

    expect(capturedPayload.text).toContain('Test Student');

    expect(capturedPayload.text).toContain(params.invitationUrl);

    expect(capturedPayload.html).toContain('Complete Registration');

    expect(capturedOptions).toEqual({
      idempotencyKey: 'invitation/test-invitation-id',
    });
  });

  it('should throw when Resend returns an API error', async () => {
    process.env.INVITATION_MAIL_MODE = 'resend';
    process.env.RESEND_API_KEY = 're_test';
    process.env.INVITATION_FROM_EMAIL = 'KSA <no-reply@hkustksa.org>';

    const errorSpy = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);

    resendSendMock.mockResolvedValue({
      data: null,
      error: {
        message: 'Resend API failure',
      },
    });

    await expect(service.sendInvitationEmail(params)).rejects.toThrow(
      'Resend invitation email sending failed',
    );

    expect(errorSpy).toHaveBeenCalledWith(
      `Resend invitation email failed (${params.idempotencyKey})`,
    );

    expect(errorSpy).not.toHaveBeenCalledWith(
      expect.stringContaining('Resend API failure'),
    );

    errorSpy.mockRestore();
  });

  it('should throw when Resend does not return an email ID', async () => {
    process.env.INVITATION_MAIL_MODE = 'resend';
    process.env.RESEND_API_KEY = 're_test';
    process.env.INVITATION_FROM_EMAIL = 'KSA <no-reply@hkustksa.org>';

    resendSendMock.mockResolvedValue({
      data: null,
      error: null,
    });

    await expect(service.sendInvitationEmail(params)).rejects.toThrow(
      'Resend did not return an email ID',
    );
  });

  it('should never log the invitation URL in resend mode', async () => {
    process.env.INVITATION_MAIL_MODE = 'resend';
    process.env.RESEND_API_KEY = 're_test';
    process.env.INVITATION_FROM_EMAIL = 'KSA <no-reply@hkustksa.org>';
    process.env.INVITATION_MOCK_LOG_URL = 'true';

    resendSendMock.mockResolvedValue({
      data: {
        id: 'email-test-id',
      },
      error: null,
    });

    const warnSpy = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);

    await service.sendInvitationEmail(params);

    expect(warnSpy).not.toHaveBeenCalled();

    warnSpy.mockRestore();
  });
});
