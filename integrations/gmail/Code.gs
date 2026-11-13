/**
 * OS Organizer — Gmail forwarder (Google Apps Script).
 *
 * Runs inside your own Google account, so there is no OAuth app to verify.
 * Every 5 minutes it sends threads labelled "os-organizer" to your app's inbox,
 * then moves them to "os-organizer/sent". Every 15 minutes it asks the app to
 * sync GitHub. Every morning it emails you the briefing: what to do today,
 * what you're waiting on, and upcoming deadlines.
 *
 * Setup:
 *   1. Create a Gmail filter that applies the label "os-organizer".
 *   2. script.google.com → New project → paste this file.
 *   3. Project Settings → Script properties: APP_URL (public URL of the app), INGEST_SECRET.
 *      Optional: BRIEFING_TO (where the briefing goes; defaults to this Google account),
 *      BRIEFING_HOUR (0–23 in the script's time zone; default 8).
 *   4. Run setup() once and approve access.
 */

var LABEL = "os-organizer";
var DONE_LABEL = "os-organizer/sent";

function setup() {
  GmailApp.getUserLabelByName(LABEL) || GmailApp.createLabel(LABEL);
  GmailApp.getUserLabelByName(DONE_LABEL) || GmailApp.createLabel(DONE_LABEL);
  ScriptApp.getProjectTriggers().forEach(function (t) {
    var fn = t.getHandlerFunction();
    if (fn === "forwardLabelled" || fn === "syncGitHub" || fn === "sendBriefing") ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger("forwardLabelled").timeBased().everyMinutes(5).create();
  ScriptApp.newTrigger("syncGitHub").timeBased().everyMinutes(15).create();
  var hour = Number(PropertiesService.getScriptProperties().getProperty("BRIEFING_HOUR") || 8);
  ScriptApp.newTrigger("sendBriefing").timeBased().everyDays(1).atHour(hour).create();
  forwardLabelled();
}

function config() {
  var props = PropertiesService.getScriptProperties();
  var appUrl = (props.getProperty("APP_URL") || "").replace(/\/$/, "");
  var secret = props.getProperty("INGEST_SECRET");
  if (!appUrl || !secret) throw new Error("Set APP_URL and INGEST_SECRET in Project Settings → Script properties.");
  return { appUrl: appUrl, secret: secret, to: props.getProperty("BRIEFING_TO") || Session.getEffectiveUser().getEmail() };
}

/** Ask the app to pull your latest PRs, issues and reviews from GitHub. */
function syncGitHub() {
  var c = config();
  var res = UrlFetchApp.fetch(c.appUrl + "/api/sync", { method: "post", headers: { "x-ingest-secret": c.secret }, muteHttpExceptions: true });
  if (res.getResponseCode() !== 200) console.warn("Sync failed: " + res.getResponseCode() + " " + res.getContentText());
}

/** Sync GitHub, then email today's briefing. Skips the email on days with nothing pressing. */
function sendBriefing() {
  var c = config();
  var opts = { headers: { "x-ingest-secret": c.secret }, muteHttpExceptions: true };
  var sync = UrlFetchApp.fetch(c.appUrl + "/api/sync", Object.assign({ method: "post" }, opts));
  if (sync.getResponseCode() !== 200) console.warn("Sync failed, sending the briefing anyway: " + sync.getContentText());

  var res = UrlFetchApp.fetch(c.appUrl + "/api/briefing", opts);
  if (res.getResponseCode() !== 200) throw new Error("Briefing failed: " + res.getResponseCode() + " " + res.getContentText());
  var b = JSON.parse(res.getContentText());
  if (b.empty) return;
  MailApp.sendEmail({ to: c.to, subject: b.subject, body: b.text, htmlBody: b.html, name: "OS Organizer" });
}

function forwardLabelled() {
  var c = config();
  var appUrl = c.appUrl;
  var secret = c.secret;

  var label = GmailApp.getUserLabelByName(LABEL);
  var done = GmailApp.getUserLabelByName(DONE_LABEL);
  var threads = label.getThreads(0, 20);

  threads.forEach(function (thread) {
    // Send every recent message, not just the last: several replies can land between runs.
    // The app ignores messages it already has (they are keyed by message id).
    var messages = thread.getMessages().slice(-10);
    var ok = messages.every(function (message) {
      return forwardMessage(message, thread, c);
    });
    if (ok) {
      thread.removeLabel(label);
      thread.addLabel(done);
    }
  });
}

/** GitHub links in the whole body, so the repo can be identified even when the text is cut. */
function githubLinks(text) {
  var seen = {};
  var out = [];
  (text.match(/https:\/\/github\.com\/[\w.-]+\/[\w.-]+(?:\/(?:issues|pull)\/\d+)?/g) || []).forEach(function (u) {
    if (!seen[u]) {
      seen[u] = true;
      out.push(u);
    }
  });
  return out.slice(0, 5);
}

function forwardMessage(message, thread, c) {
  var plain = message.getPlainBody();
  var links = githubLinks(plain);
  var payload = {
    source: "gmail",
    externalId: message.getId(),
    title: (message.getSubject() || "(no subject)").slice(0, 400),
    body: (plain.slice(0, 3800) + (links.length ? "\n\n" + links.join("\n") : "")).slice(0, 7900),
    url: "https://mail.google.com/mail/u/0/#all/" + thread.getId(),
    author: (message.getFrom() || "").slice(0, 190),
    context: (message.getHeader("List-Id") || message.getHeader("X-GitHub-Reason") || "").slice(0, 280) || null,
    receivedAt: message.getDate().toISOString(),
  };
  var res = UrlFetchApp.fetch(c.appUrl + "/api/inbox", {
    method: "post",
    contentType: "application/json",
    headers: { "x-ingest-secret": c.secret },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  });
  if (res.getResponseCode() !== 200) {
    console.warn("OS Organizer rejected a message: " + res.getResponseCode() + " " + res.getContentText());
    return false;
  }
  return true;
}
