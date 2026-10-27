/**
 * Written descriptions of each program. These are the parts no API gives us, so
 * they are kept short and stick to what stays true from year to year. Dates
 * come from the Programs timeline, and rules that change every cycle are left
 * to the official links.
 */

export type ProgramProfile = {
  id: string;
  /** One line under the title. */
  tagline: string;
  /** Who runs it. */
  organizer: string;
  /** Label, value pairs for the at-a-glance panel. */
  facts: { label: string; value: string }[];
  /** The path from first look to finished project, in order. */
  steps: { title: string; body: string }[];
  /** Advice that applies to this program in particular. */
  advice: string[];
  links: { label: string; url: string }[];
  /** Where the organization history on the page comes from. */
  source: string;
};

export const PROGRAM_PROFILES: Record<string, ProgramProfile> = {
  gsoc: {
    id: "gsoc",
    tagline: "Paid, mentored open source projects with a different set of organizations every year.",
    organizer: "Google",
    facts: [
      { label: "Run by", value: "Google" },
      { label: "Started", value: "2005" },
      { label: "Rhythm", value: "One cycle a year, with organizations announced before contributors apply" },
      { label: "Who can apply", value: "Newcomers to open source, 18 or older. Not limited to students." },
      { label: "Project size", value: "Set by the project, roughly 90, 175 or 350 hours, spread over 12 to 22 weeks" },
      { label: "Stipend", value: "Paid by Google in stages after evaluations. The amount depends on project size and your country." },
      { label: "How you apply", value: "A proposal to one organization, written with its mentors, submitted on the GSoC site" },
    ],
    steps: [
      { title: "Orgs are announced", body: "Google publishes the accepted organizations and their idea lists. This is the first moment you know who is in this year." },
      { title: "Show up early", body: "Join the chat, pick a small issue and get a pull request merged. Most organizations look for this before they read a proposal." },
      { title: "Write the proposal", body: "Choose an idea, or pitch your own, and draft a plan with a timeline. Ask a mentor to review it before the deadline." },
      { title: "Submit and wait", body: "Applications close on a fixed date. Organizations then rank proposals and slots are allotted." },
      { title: "Bond, then code", body: "A community bonding period comes first, then coding with a midterm and a final evaluation." },
    ],
    advice: [
      "Organizations that have attended many years in a row tend to keep a stable idea list and a known review pattern. Use the regularity label on each organization to find them.",
      "Organizations that are new this year have no track record to read, so ask about their mentors’ availability before you invest.",
      "The same project can be reused by returning organizations. Reading their past project lists shows what they actually accept.",
    ],
    links: [
      { label: "Official site", url: "https://summerofcode.withgoogle.com" },
      { label: "Program timeline", url: "https://developers.google.com/open-source/gsoc/timeline" },
      { label: "Contributor guide", url: "https://google.github.io/gsocguides/student/" },
      { label: "Past organizations", url: "https://summerofcode.withgoogle.com/archive" },
    ],
    source: "Google’s public GSoC archive, covering every year back to 2016. The current year lists announced organizations only, since no project has finished yet.",
  },

  lfx: {
    id: "lfx",
    tagline: "Mentorships across Linux Foundation projects, with a new term every few months.",
    organizer: "The Linux Foundation",
    facts: [
      { label: "Run by", value: "The Linux Foundation" },
      { label: "Rhythm", value: "Three terms a year: spring, summer and fall" },
      { label: "Who can apply", value: "Open to students and working developers. Each project lists the skills it needs." },
      { label: "Length", value: "A term lasts about 12 weeks, full time or part time" },
      { label: "Stipend", value: "Shown on each project and based on its level and your location" },
      { label: "How you apply", value: "Per project, through the LFX platform, usually with a resume and a cover letter" },
    ],
    steps: [
      { title: "Browse projects", body: "Mentorships are listed one project at a time, grouped by the LF foundation that hosts them." },
      { title: "Read the requirements", body: "Each listing names skills and sometimes a pre-task or coding challenge. Do it before you apply." },
      { title: "Apply to the project", body: "Send your application through LFX. Mentors review and may interview you." },
      { title: "Work the term", body: "You agree milestones with your mentor and are evaluated against them." },
    ],
    advice: [
      "In this directory an organization is the foundation hosting a mentorship, such as CNCF or OpenSSF, not one single mentorship. Open its page to see the individual projects by year.",
      "A foundation that has mentorships in many terms has an established process. Look at which of its projects return.",
    ],
    links: [
      { label: "LFX Mentorship", url: "https://mentorship.lfx.linuxfoundation.org" },
      { label: "Mentee guide", url: "https://docs.linuxfoundation.org/lfx/mentorship/mentee-guide" },
    ],
    source: "The public LFX Mentorship API. Each mentorship is counted in the year its term starts.",
  },

  sob: {
    id: "sob",
    tagline: "A summer of paid work on Bitcoin and Lightning open source.",
    organizer: "Summer of Bitcoin",
    facts: [
      { label: "Run by", value: "Summer of Bitcoin" },
      { label: "Started", value: "2021" },
      { label: "Rhythm", value: "One program a year" },
      { label: "Focus", value: "Bitcoin, Lightning and the tools around them" },
      { label: "Who can apply", value: "Aimed at students and early career developers. Read the current student guide for eligibility." },
      { label: "How you apply", value: "A qualifying step comes first, then a proposal to an organization" },
    ],
    steps: [
      { title: "Learn the basics", body: "Read the student guide and the Bitcoin material it points to. The work assumes you know how the protocol fits together." },
      { title: "Clear the qualifier", body: "The program screens applicants before it matches them with organizations." },
      { title: "Contribute and propose", body: "Pick an organization from the year’s list, contribute, and write a proposal." },
      { title: "Work the program", body: "Selected contributors work with a mentor through the summer." },
    ],
    advice: [
      "Many of the organizations here are small repositories rather than large foundations. A short history can still mean a healthy project, so judge by recent activity.",
      "Technology tags are only listed for the current year’s organizations, so older entries show projects but not stacks.",
    ],
    links: [
      { label: "Official site", url: "https://www.summerofbitcoin.org" },
      { label: "Student guide", url: "https://guide.summerofbitcoin.org/" },
      { label: "Past programs", url: "https://www.summerofbitcoin.org/past-programs" },
    ],
    source: "Read from summerofbitcoin.org, which has no data feed. Organizations are listed as the site names them, so a renamed project can appear twice.",
  },

  outreachy: {
    id: "outreachy",
    tagline: "Paid remote internships for people underrepresented in tech.",
    organizer: "Software Freedom Conservancy",
    facts: [
      { label: "Run by", value: "Software Freedom Conservancy" },
      { label: "Rhythm", value: "Two rounds a year, one starting in May and one in December" },
      { label: "Who can apply", value: "People who face systemic bias or underrepresentation in the tech industry where they live. Students and non-students." },
      { label: "Length", value: "Three months, remote" },
      { label: "Stipend", value: "A fixed stipend for the internship. Check the current amount on the site." },
      { label: "How you apply", value: "An eligibility application, then a contribution period, then a final application with your chosen project" },
    ],
    steps: [
      { title: "Initial application", body: "You show you meet the eligibility rules and describe your availability. Do this before the contribution period starts." },
      { title: "Contribution period", body: "About a month of real contributions to the communities you are interested in, working with mentors." },
      { title: "Final application", body: "Pick a project and submit your application with the contributions you made." },
      { title: "Intern", body: "Selected applicants work with their mentors for three months." },
    ],
    advice: [
      "The contribution period is the application. Start talking to mentors the day projects are published.",
      "Communities here are listed as they appear in each round’s intern announcement, so the list is of communities that took interns, not all that offered projects.",
    ],
    links: [
      { label: "Official site", url: "https://www.outreachy.org" },
      { label: "Apply", url: "https://www.outreachy.org/apply/" },
      { label: "Eligibility", url: "https://www.outreachy.org/apply/eligibility/" },
      { label: "Past interns by round", url: "https://www.outreachy.org/alums/" },
    ],
    source: "Outreachy’s published intern lists for each round. Only the community and project are kept, never the intern’s details.",
  },
};
