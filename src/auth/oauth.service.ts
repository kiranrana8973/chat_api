import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { OAuth2Client } from "google-auth-library";
import * as appleSignin from "apple-signin-auth";

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

@Injectable()
export class OAuthService {
  private googleClient: OAuth2Client;

  constructor(private configService: ConfigService) {
    this.googleClient = new OAuth2Client(
      this.configService.get<string>("GOOGLE_CLIENT_ID"),
    );
  }

  async verifyGoogleToken(idToken: string): Promise<GooglePayload> {
    const ticket = await this.googleClient.verifyIdToken({
      idToken,
      audience: this.configService.get<string>("GOOGLE_CLIENT_ID"),
    });
    const payload = ticket.getPayload();

    if (!payload.email_verified) {
      throw new Error("Google email is not verified.");
    }

    return {
      oauthId: payload.sub,
      email: payload.email,
      fname: payload.given_name || "",
      lname: payload.family_name || "",
      avatar: payload.picture || "",
    };
  }

  async verifyAppleToken(identityToken: string): Promise<ApplePayload> {
    const payload = await appleSignin.verifyIdToken(identityToken, {
      audience: this.configService.get<string>("APPLE_CLIENT_ID"),
      ignoreExpiration: false,
    });

    if (!payload.sub) {
      throw new Error("Invalid Apple token: missing subject.");
    }

    return {
      oauthId: payload.sub,
      email: payload.email || null,
    };
  }
}
