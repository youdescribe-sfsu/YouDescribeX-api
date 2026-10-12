import { MongoAudioDescriptionRatingModel, MongoHistoryModel, MongoUsersModel } from '../models/mongodb/init-models.mongo';
import { revokeAppleSignIn } from '../utils/appleRevoke';
import { logger } from '../utils/logger';

export const DELETED_NAME = 'Deleted user';

/**
 * Account deletion from the mobile app (App Store guideline 5.1.1(v)).
 * Personal details and sign-in IDs are wiped, so nobody can sign in to the account again and nothing identifies the
 * person. The user record itself stays: descriptions, clips and ratings point at it, and the descriptions keep
 * playing for viewers, credited to "Deleted user". Viewing history is deleted and rating comments are cleared;
 * rating scores stay because they are part of each description's average.
 */
class MobileAccountService {
  public async deleteAccount(userId: string, appleAuthorizationCode?: string) {
    const user = await MongoUsersModel.findById(userId);
    if (!user) throw new Error(`User ${userId} not found`);

    if ((user as { apple_user_id?: string }).apple_user_id && appleAuthorizationCode) {
      try {
        await revokeAppleSignIn(appleAuthorizationCode);
      } catch (error) {
        // The person asked to be deleted; a refusal from Apple must not keep their data.
        logger.warn(`Apple revoke failed for deleted user ${userId}: `, error);
      }
    }

    await MongoUsersModel.updateOne(
      { _id: userId },
      {
        $set: {
          // email is required by the schema; .invalid is a reserved domain, so nothing is ever sent to it.
          email: `deleted-${userId}@deleted.invalid`,
          name: DELETED_NAME,
          given_name: '',
          alias: '',
          picture: '',
          locale: '',
          google_user_id: '',
          apple_user_id: '',
          token: '',
          opt_in: false,
          opt_in_wishlist_published: false,
          opt_in_ai_feedback: false,
          admin_level: 0,
        },
        $unset: { google_user_id_token: '', hash: '', salt: '' },
      },
      { strict: false },
    );
    await MongoHistoryModel.deleteMany({ user: userId });
    await MongoAudioDescriptionRatingModel.updateMany({ user: userId }, { $set: { comment: '', feedback: [] } });
  }
}

export default MobileAccountService;
