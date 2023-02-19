import UsersRoute from './routes/users.route';
import validateEnv from './utils/validateEnv';
import App from './app';
import VideosRoute from './routes/videos.route';
import NotesRoute from './routes/notes.route';

validateEnv();

const app = new App([new UsersRoute(), new VideosRoute(), new NotesRoute()]);

app.listen();
