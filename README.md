# Customizable Feedback Project
This project offers a customizable feedback solution that can be easily integrated into any other application via a redirect URL. It consists of an intuitive user interface (front-end) and an HTTP server (back-end) that handles webhooks to collect meeting and user data.

## Project Structure
### Front-end
The front-end is responsible for the entire user interface. It allows users to interact with the feedback system in a user-friendly and efficient manner.
Additional feedback options can be added or existing options can be modified via the feedbackData.json file. This file is mapped to render the feedback options and steps.

### Back-end
The back-end is an HTTP server that listens for webhooks and collects data on meetings and users. This data is processed and stored in the server's database.
At the end of the feedback process, the HTTP server receives the feedback data and data extracted from the URL, which contains meetingId and userId, and will be used to find their corresponding records in the server's database.

## Production
Modifications to the nginx files are required as follows:
```
location /feedback {
        proxy_pass http://localhost:3009/feedback;
}

```
Changes to docker-compose.yml are required.Add your:
FEEDBACK_URL -> it will be the destination url for the feedback submit
SHARED_SECRET -> add your server secret
BASIC_URL -> domain of your server without /bigbluebutton/


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