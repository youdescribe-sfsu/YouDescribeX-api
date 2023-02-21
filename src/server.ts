import UsersRoute from './routes/users.route';
import validateEnv from './utils/validateEnv';
import App from './app';
import VideosRoute from './routes/videos.route';
import NotesRoute from './routes/notes.route';
import DialogTimestampsRoute from './routes/dialog_timestamps.route';
import TimingsRoute from './routes/timings.route';

validateEnv();

const app = new App([new UsersRoute(), new VideosRoute(), new NotesRoute(), new DialogTimestampsRoute(), new TimingsRoute()]);

app.listen();
