# CHANGELOG

All notable changes to this project will be documented in this file.

### v1.11.0

* feat: add early skip for specific reason/error codes
* build(backend): express@4.22.1
* build(backend): body-parser@1.20.4
* build(frontend): react-router-dom@6.30.3
* build(frontend): vite@7.1.12

### v1.10.1

* fix(frontend): improves error handling for invalid sessions

### v1.10.0

* feat: add audio/camera/screenShareBridge info to feedbacks
* fix: missing institution fields in feedbacks submitted after meeting end
* fix: use ISO timestamps in backend logs
* build(frontend): vite@v7.1.5

### v1.9.0

* feat: capture feedback rating on page leave or unload
* feat: add external user ID to feedback reports

### v1.8.0

* feat: migrate to Vite and Node.js' native Fetch API
* fix(backend): extend default expiration of redis hash keys
* fix: missing institution fields from feedbacks

### v1.7.0

* feat: add support for 'ask_for_feedback_on_logout' parameter
* feat: update feedback questions/answers
* fix: changes to include end reason and redirect timeout
* fix: styles adjustments & remove progress indicador on error screen
* fix(backend): handle Redis hash keys with expiration and cleanup
* fix: replaces deprecated `ReactDOM.render`
* build(frontend): npm audit fix

### v1.6.0

* feat: enhance UI and generalize steps
* feat: add Italian localization
* fix: tweaks for larger devices
* fix: user-typed answers were not submitted with feedback
* build: npm audit fix on backend and frontend

### v1.5.1

* fix: client not redirected when feedback is directly skipped

### v1.5.0

* feat(hooks): If using registered hooks and it fails, exit
* fix(hooks): Option to not register hooks (for permanent hooks)

### v1.4.0

* fix: Don't send feedback with no rating and don't send duplicated feedback
* fix(form): drop the feedback prefix in some form answers

### v1.3.0

* feat: show endReason from url when available

### v1.2.0

* feat: feat: use locale from userdata if present
* More detailed README file

### v1.1.0

* feat: Use meta_feedbackredirecturl to redirect after feedback
* feat: add support for userdata_bbb_feedback_redirect_url
* feat: configurable redirect timeout
* fix: improve feedback submission log format
* fix: handle mconf-institution-guid and mconf-institution-name meta params
