/**
 * OS Organizer — Gmail forwarder (Google Apps Script).
 *
 * Runs inside your own Google account, so there is no OAuth app to verify.
 * Every 5 minutes it sends threads labelled "os-organizer" to your app's inbox,
 * then moves them to "os-organizer/sent".
 *
 * Setup:
 *   1. Create a Gmail filter that applies the label "os-organizer".
 *   2. script.google.com → New project → paste this file.
 *   3. Project Settings → Script properties: APP_URL (public URL of the app), INGEST_SECRET.
 *   4. Run setup() once and approve access.
 */

var LABEL = "os-organizer";
var DONE_LABEL = "os-organizer/sent";

function setup() {
  GmailApp.getUserLabelByName(LABEL) || GmailApp.createLabel(LABEL);
  GmailApp.getUserLabelByName(DONE_LABEL) || GmailApp.createLabel(DONE_LABEL);
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === "forwardLabelled") ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger("forwardLabelled").timeBased().everyMinutes(5).create();
  forwardLabelled();
}

function forwardLabelled() {
  var props = PropertiesService.getScriptProperties();
  var appUrl = (props.getProperty("APP_URL") || "").replace(/\/$/, "");
  var secret = props.getProperty("INGEST_SECRET");
  if (!appUrl || !secret) throw new Error("Set APP_URL and INGEST_SECRET in Project Settings → Script properties.");

  var label = GmailApp.getUserLabelByName(LABEL);
  var done = GmailApp.getUserLabelByName(DONE_LABEL);
  var threads = label.getThreads(0, 20);

  threads.forEach(function (thread) {
    var message = thread.getMessages().pop();
    var payload = {
      source: "gmail",
      externalId: message.getId(),
      title: message.getSubject() || "(no subject)",
      body: message.getPlainBody().slice(0, 4000),
      url: "https://mail.google.com/mail/u/0/#all/" + thread.getId(),
      author: message.getFrom(),
      context: message.getHeader("List-Id") || message.getHeader("X-GitHub-Reason") || null,
      receivedAt: message.getDate().toISOString(),
    };
    var res = UrlFetchApp.fetch(appUrl + "/api/inbox", {
      method: "post",
      contentType: "application/json",
      headers: { "x-ingest-secret": secret },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true,
    });
    if (res.getResponseCode() === 200) {
      thread.removeLabel(label);
      thread.addLabel(done);
    } else {
      console.warn("OS Organizer rejected a thread: " + res.getResponseCode() + " " + res.getContentText());
    }
  });
}
