# CHANGELOG

All notable changes to this project will be documented in this file.

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
