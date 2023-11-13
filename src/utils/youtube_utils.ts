import { NODE_ENV } from '../config';

const youTubeApiUrl = 'https://www.googleapis.com/youtube/v3';

let youTubeApiKey = 'AIzaSyAfU2tpVpMKmIyTlRljnKfPUFWXrNXg21Q';

if (NODE_ENV == 'dev') {
  youTubeApiKey = 'AIzaSyBQFD0fJoEO2l8g0OIrqbtjj2qXXVNO__U';
} else if (NODE_ENV == 'prod') {
  youTubeApiKey = 'AIzaSyDV8QMir3NE8S2jA1GyXvLXyTuSq72FPyE';
}

export { youTubeApiUrl, youTubeApiKey };

// const youTubeApiKey = "AIzaSyCEMAn_7h1wgIgZ4xhLbQUDuLKlkmvgLHs";     // !!! occupied by ios app !!! (google cloud project: youdescribesfsu@gmail.com -> youdescribe)
// const youTubeApiKey = "AIzaSyDV8QMir3NE8S2jA1GyXvLXyTuSq72FPyE"; // !!! occupied by https://youdescribe.org !!! (google cloud project: youdescribeadm@gmail.com -> youdescribe-0126)
// const youTubeApiKey = "AIzaSyBQFD0fJoEO2l8g0OIrqbtjj2qXXVNO__U";     // !!! occupied by https://dev.youdescribe.org !!! (google cloud project: youdescribeadm@gmail.com -> youdescribe-0127)
//const youTubeApiKey = "AIzaSyBWQ2o3N0MVc8oP96JvWVVwqjxpEOgkhQU";     // !!! occupied by http://18.221.192.73:3001 !!! (google cloud project: youdescribeadm@gmail.com -> youdescribe-0612)
//const youTubeApiKey = "AIzaSyAfU2tpVpMKmIyTlRljnKfPUFWXrNXg21Q";     // free to use (google cloud project: youdescribeadm@gmail.com -> youdescribe-0613)
