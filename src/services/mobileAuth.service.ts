import moment from 'moment';
import { MongoUsersModel } from '../models/mongodb/init-models.mongo';

export interface MobileSignIn {
  provider: 'google' | 'apple';
  /** the provider's user ID (the token's `sub`) */
  sub: string;
  email: string;
  /** true when the provider confirmed the person owns the email and it is not a relay address */
  emailTrusted: boolean;
  token: string;
  name?: string;
  given_name?: string;
  picture?: string;
  locale?: string;
}

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Finds or creates the account for a mobile sign-in, so Google and Apple open the same account for one person:
 * 1. the user who already has this provider ID;
 * 2. otherwise, when the email is trusted, the most recently active user with that email (any case), which gets
 *    this provider ID added, unless it already has a different one;
 * 3. otherwise a new user, with the same defaults as the web's Google login.
 * The web login (UserService.createNewUser) is separate and unchanged.
 */
class MobileAuthService {
  public async findOrCreateUser(s: MobileSignIn) {
    const idField = s.provider === 'google' ? 'google_user_id' : 'apple_user_id';
    const now = moment().utc().format('YYYYMMDDHHmmss');
    const login = { last_login: now, updated_at: now, token: s.token };

    const returning = await MongoUsersModel.findOneAndUpdate({ [idField]: s.sub }, { $set: login }, { new: true });
    if (returning) return returning;

    if (s.emailTrusted && s.email) {
      const match = await MongoUsersModel.findOne({ email: new RegExp(`^${escapeRegExp(s.email)}$`, 'i') }).sort({ last_login: -1 });
      if (match && !match[idField]) {
        // Conditional on the ID still being empty, so two sign-ins at once cannot both claim the account.
        const linked = await MongoUsersModel.findOneAndUpdate(
          { _id: match._id, [idField]: { $in: ['', null] } },
          { $set: { ...login, [idField]: s.sub } },
          { new: true },
        );
        if (linked) return linked;
      }
    }

    return MongoUsersModel.create({
      email: s.email,
      name: s.name ?? '',
      given_name: s.given_name ?? '',
      picture: s.picture ?? '',
      locale: s.locale ?? '',
      google_user_id: s.provider === 'google' ? s.sub : '',
      apple_user_id: s.provider === 'apple' ? s.sub : '',
      token: s.token,
      opt_in: false,
      admin_level: 0,
      user_type: 'Volunteer',
      last_login: now,
    });
  }
}

export default MobileAuthService;
