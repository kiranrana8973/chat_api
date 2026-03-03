import { ConfigService } from "@nestjs/config";
export interface GooglePayload {
    oauthId: string;
    email: string;
    fname: string;
    lname: string;
    avatar: string;
}
export interface ApplePayload {
    oauthId: string;
    email: string | null;
}
export declare class OAuthService {
    private configService;
    private googleClient;
    constructor(configService: ConfigService);
    verifyGoogleToken(idToken: string): Promise<GooglePayload>;
    verifyAppleToken(identityToken: string): Promise<ApplePayload>;
}
