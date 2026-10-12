import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback } from 'passport-oauth2';
import { AuthService } from './auth.service';

export interface OAuth2Profile {
  id: string;
  displayName: string;
  emails: Array<{ value: string }>;
  photos: Array<{ value: string }>;
  provider: 'google' | 'github' | 'discord';
}

/**
 * Google OAuth2 Strategy
 */
@Injectable()
export class GoogleOAuth2Strategy extends PassportStrategy(Strategy, 'google') {
  constructor(private authService: AuthService) {
    super({
      authorizationURL: 'https://accounts.google.com/o/oauth2/v2/auth',
      tokenURL: 'https://www.googleapis.com/oauth2/v4/token',
      userProfileURL: 'https://www.googleapis.com/oauth2/v1/userinfo?alt=json',
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: `${process.env.API_URL}/auth/oauth2/google/callback`,
      scope: ['profile', 'email'],
    });
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: OAuth2Profile,
    done: VerifyCallback,
  ) {
    const email = profile.emails[0].value;
    const user = await this.authService.findOrCreateOAuth2User({
      email,
      displayName: profile.displayName,
      provider: 'google',
      providerId: profile.id,
      avatar: profile.photos[0].value,
    });

    done(null, user);
  }
}

/**
 * GitHub OAuth2 Strategy
 */
@Injectable()
export class GitHubOAuth2Strategy extends PassportStrategy(Strategy, 'github') {
  constructor(private authService: AuthService) {
    super({
      authorizationURL: 'https://github.com/login/oauth/authorize',
      tokenURL: 'https://github.com/login/oauth/access_token',
      userProfileURL: 'https://api.github.com/user',
      clientID: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
      callbackURL: `${process.env.API_URL}/auth/oauth2/github/callback`,
      scope: ['user:email'],
    });
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: OAuth2Profile,
    done: VerifyCallback,
  ) {
    const email = profile.emails[0].value;
    const user = await this.authService.findOrCreateOAuth2User({
      email,
      displayName: profile.displayName,
      provider: 'github',
      providerId: profile.id,
      avatar: profile.photos[0].value,
    });

    done(null, user);
  }
}

/**
 * Discord OAuth2 Strategy
 */
@Injectable()
export class DiscordOAuth2Strategy extends PassportStrategy(Strategy, 'discord') {
  constructor(private authService: AuthService) {
    super({
      authorizationURL: 'https://discord.com/api/oauth2/authorize',
      tokenURL: 'https://discord.com/api/oauth2/token',
      userProfileURL: 'https://discord.com/api/users/@me',
      clientID: process.env.DISCORD_CLIENT_ID,
      clientSecret: process.env.DISCORD_CLIENT_SECRET,
      callbackURL: `${process.env.API_URL}/auth/oauth2/discord/callback`,
      scope: ['identify', 'email'],
    });
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: OAuth2Profile,
    done: VerifyCallback,
  ) {
    const email = profile.emails[0].value;
    const user = await this.authService.findOrCreateOAuth2User({
      email,
      displayName: profile.displayName,
      provider: 'discord',
      providerId: profile.id,
      avatar: profile.photos[0].value,
    });

    done(null, user);
  }
}
