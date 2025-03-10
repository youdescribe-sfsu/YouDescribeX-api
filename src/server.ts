import UsersRoute from './routes/users.route';
import validateEnv from './utils/validateEnv';
import App from './app';
import VideosRoute from './routes/videos.route';
import NotesRoute from './routes/notes.route';
import DialogTimestampsRoute from './routes/dialog_timestamps.route';
import TimingsRoute from './routes/timings.route';
import ParticipantsRoute from './routes/participants.route';
import AudioDescriptionsRoute from './routes/audio_descriptions.route';
import AudioClipsRoute from './routes/audioClips.route';
import AuthRoute from './routes/auth.route';
import WishListRoute from './routes/wishlist.route';
import GpuUtilsRoute from './routes/gpu_utils.route';
import audioDescriptionRatingRoute from './routes/audioDescriptionRating.route';
import YouTubeProxyRoute from './routes/youtube-proxy.route';

validateEnv();

const app = new App([
  new UsersRoute(),
  new VideosRoute(),
  new NotesRoute(),
  new DialogTimestampsRoute(),
  new TimingsRoute(),
  new ParticipantsRoute(),
  new AudioDescriptionsRoute(),
  new AudioClipsRoute(),
  new AuthRoute(),
  new WishListRoute(),
  new GpuUtilsRoute(),
  new audioDescriptionRatingRoute(),
  new YouTubeProxyRoute(),
]);

app.listen();
