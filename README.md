# Customizable BigBlueButton feedback form

This project offers a customizable feedback solution that can be easily integrated into any other application via a redirect URL. It consists of an intuitive user interface (front-end) and an HTTP server (back-end) that handles webhooks to collect meeting and user data.

Compatible with Bigbluebutton >= 3.0

    Package coming soon

## Project Structure

### Front-end

The front-end is responsible for the entire user interface. It allows users to interact with the feedback system in a user-friendly and efficient manner.

Additional feedback options can be added or existing options can be modified via the feedbackData.json file. This file is mapped to render the feedback options and steps.

### Back-end

The back-end is an HTTP server that listens for webhooks and collects data on meetings and users. This data is processed and stored in the server's database.

At the end of the feedback process, the HTTP server receives the feedback data and data extracted from the URL, which contains meetingId and userId, and will be used to find their corresponding records in the server's database.

## Running with docker-compose

    docker-compose up

Changes the docker-compose.yml to fit your use caser:

    FEEDBACK_URL (optional)
      Where to submit the feedback object. With no URL results will be exclusivelly logged

   SHARED_SECRET
     Your server's shared secret used to register web hooks

    BASIC_URL
      Domain of your server without the /bigbluebutton/

    REDIRECT_URL (optional)
      Where to redirect user after the feedback form. Can also be set by `userdata-feedbackredirecturl` or `metadata_feedbackredirecturl`

    REDIRECT_TIMEOUT
      default: 10000

    LOG_LEVEL
      default: info
      valid values: error, debug, info, verbose

    LOG_STDOUT
      default: true

    PORT
      default: 3009

## Deploying to Production

After spinning up the back-end server you'll need to drop this nginx file on your server:

```
/usr/share/local/bigbluebutton/feedback.nginx

location /feedback {
        proxy_pass http://localhost:3009/feedback;
}
```

Configure `bbb-web` to redirect logged out users to the custom feedback application after they leave the meeting:

The correct value should be https://YOUR_BBB_HOST/feedback?userId=%%USERID%%&meetingId=%%MEETINGID%%

* Edit `logoutURL` in `/usr/share/bbb-web/WEB-INF/classes/bigbluebutton.properties`
* Or create your meeting with `logoutURL`
* Or send it via `userdata-logoutURL`

## Customizing the feedback form

Consult the example JSON feedback form for more details: https://github.com/mconf/custom-feedback/blob/master/frontend/src/feedbackData.json

## Dependencies

### Backend
body-parser: ^1.20.2
express: ^4.19.2
node-fetch: ^3.3.2
redis: ^4.7.0
request: ^2.88.2
### Frontend
react: ^18.3.1
react-dom: ^18.3.1
react-router-dom: ^6.25.1
react-icons: ^5.2.1
react-intl: ^6.6.8
react-i18next: ^14.1.3
i18next: ^23.12.2
styled-components: ^6.1.12
ua-parser-js: ^1.0.38

## License
This project is licensed under the GNU Lesser General Public License v3.0 - see the [LICENSE](./LICENSE) file for details.
