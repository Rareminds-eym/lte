**PRODUCT REQUIREMENTS DOCUMENT**

**LTE 3-Week MVP**

**Assessment Output to Role-Based Learning, Evidence, XP, Readiness and
Marketplace Eligibility**

Product-only PRD updated with feature priorities, assumptions, risks and
dedicated out-of-scope

+----------------------------------+----------------------------------+---+
| **Document Field**               | **Details**                      |   |
+==================================+==================================+===+
| **Company**                      | Rareminds Pvt. Ltd.              |   |
+----------------------------------+----------------------------------+---+
| **Prepared For**                 | Product, L&D/content, AI, QA,    |   |
|                                  | admin, placement, delivery and   |   |
|                                  | engineering alignment teams      |   |
+----------------------------------+----------------------------------+---+
| **Version**                      | V1.1 - Product-only PRD with     |   |
|                                  | Priorities, Assumptions, Risks   |   |
|                                  | and Out-of-Scope                 |   |
+----------------------------------+----------------------------------+---+
| **Status**                       | Draft PRD for                    |   |
|                                  | leadership/product/governance    |   |
|                                  | sign-off                         |   |
+----------------------------------+----------------------------------+---+
| **Build Duration**               | 3 weeks                          |   |
+----------------------------------+----------------------------------+---+
| **Primary Scope**                | College/adult LTE role-readiness |   |
|                                  | journey from assessment output   |   |
|                                  | to marketplace eligibility       |   |
|                                  | status                           |   |
+----------------------------------+----------------------------------+---+
| **Explicit Boundary**            | School Showcase/Beyond Marks     |   |
|                                  | Grade 6-8 child-development flow |   |
|                                  | is not included in this 3-week   |   |
|                                  | LTE MVP unless separately        |   |
|                                  | approved                         |   |
+----------------------------------+----------------------------------+---+
| **Core Product Rule**            | Build a deterministic            |   |
|                                  | role-readiness engine with       |   |
|                                  | learning execution, evidence,    |   |
|                                  | mastery, readiness and           |   |
|                                  | marketplace eligibility - not a  |   |
|                                  | traditional LMS                  |   |
+----------------------------------+----------------------------------+---+
| **MVP North Star**               |                                  |   |
|                                  |                                  |   |
| One learner should complete the  |                                  |   |
| complete journey: track or role  |                                  |   |
| assigned, roadmap visible,       |                                  |   |
| course started, problem solved,  |                                  |   |
| artifact uploaded, AI/rubric     |                                  |   |
| reviewed, XP awarded only for    |                                  |   |
| valid successful events,         |                                  |   |
| dashboard updated, readiness     |                                  |   |
| score calculated with context,   |                                  |   |
| and marketplace eligibility      |                                  |   |
| status shown.                    |                                  |   |
+----------------------------------+----------------------------------+---+

Contents

-   1\. Executive Summary

-   2\. Product Architecture and Mode Separation

-   3\. Assumptions

-   4\. MVP Objective and Success Definition

-   5\. Feature Priorities

-   6\. User Roles and Jobs-to-Be-Done

-   7\. End-to-End MVP Flow

-   8\. Functional Requirements by Flow Stage

-   9\. 6E Learning Design Requirements

-   10\. Artifact Evidence and AI Review Requirements

-   11\. XP Rules and Readiness Impact

-   12\. Readiness Formula and Marketplace Eligibility

-   13\. Learner Dashboard Experience

-   14\. MVP Product Operations and Governance Requirements

-   15\. Content Architecture and Upload Strategy

-   16\. Consent, Privacy and Marketplace Visibility

-   17\. Risks

-   18\. Dedicated Out-of-Scope

-   19\. QA and Acceptance Criteria

-   20\. Product Decisions to Freeze Before Coding

-   21\. Sign-Off and Change Control

1\. Executive Summary

This PRD defines the product scope for the 3-week LTE MVP. The MVP
converts existing Skill Ecosystem assessment outputs into a role-based
learning execution journey. It reuses existing login, learner profile,
assessment output, AI report/three-track result, roles under tracks and
marketplace where available.

The new MVP work is the missing middle layer: role-course-roadmap
mapping, 6E module delivery, real-world problem statement workflow,
artifact submission, AI/rubric review, XP allocation, learner dashboard
update, readiness calculation and marketplace eligibility status.

+-----------------------------------------------------------------------+
| **Execution Principle**                                               |
|                                                                       |
| Engine first, content scale second. Upload the visible taxonomy and   |
| role shells so the product structure is clear, but deep-build only a  |
| controlled priority content set so the learner journey works          |
| flawlessly in the 3-week demo.                                        |
+=======================================================================+
+-----------------------------------------------------------------------+

This document intentionally keeps product requirements and removes
detailed API, database field and engineering implementation
specifications. Those details should live in the SRD/TRD and engineering
handover documents.

2\. Product Architecture and Mode Separation

The Skill Ecosystem has connected but separate product modes. This PRD
covers only the LTE role-readiness MVP for older learners and
college/adult learners.

-   LTE - Learn, Transform, Earn: Included. This is the role-readiness
    and learning execution engine using mastery, evidence, readiness and
    marketplace eligibility.

-   Resource Studio: Included only as the LTE course/module workspace
    where learners access assigned modules, resources, evidence tasks
    and feedback.

-   School Showcase / Beyond Marks: Not included in this 3-week LTE MVP.
    Grade 6-8 child-safe growth reporting, parent insight and school
    dashboard remain a separate mode.

-   Marketplace: Included only as eligibility status and visibility
    control. Advanced recruiter AI matching, ranking and shortlisting
    are not included in this MVP.

3\. Assumptions

The following assumptions must hold true for the 3-week MVP plan. If any
assumption fails, scope, timeline or acceptance criteria may need to be
revised.

-   Existing login, learner profile and institution context are
    functional and reusable.

-   Skill Ecosystem assessment output or three-track report is
    accessible to LTE.

-   Priority roles, course shells, problem statements and rubrics will
    be supplied before Week 2 execution begins.

-   Manual/admin role assignment is acceptable for MVP wherever
    automated assignment is not ready.

-   The MVP focuses on one complete learner loop before scaling to all
    industries, domains and roles.

-   AI/rubric review can be supported by a fallback manual or
    rubric-based review if AI is unavailable or low-confidence.

-   Failed, incomplete, rejected or resubmission-required artifacts do
    not receive XP and do not increase readiness.

-   Marketplace eligibility and marketplace visibility are separate;
    visibility requires active versioned consent.

-   Readiness formula, marketplace bands and product decision records
    will be approved before coding or before the relevant module is
    finalized.

-   School Showcase / Beyond Marks Grade 6-8 flow remains outside this
    PRD unless separately approved.

4\. MVP Objective and Success Definition

The objective is to prove that one learner can move from assessment
output into a role-based course, submit evidence, receive AI/rubric
feedback, earn valid XP, see readiness and get a marketplace eligibility
status. This proves that the LTE engine is working before expanding full
content depth.

-   Learner login and profile are reused successfully.

-   Assessment output or 3-track report is visible or linked.

-   Learner can select a role or receive an admin-assigned role.

-   6-month roadmap is visible with learning milestones.

-   Role-based course and module flow opens correctly.

-   6E module sequence works without stage skipping.

-   Problem statement and expected output are clear.

-   Artifact upload or link submission works.

-   AI/rubric review returns score, feedback and resubmission guidance
    where needed.

-   XP is awarded only for approved valid events, not failed attempts.

-   Learner dashboard updates progress, artifact status, AI review
    status, XP and next action.

-   Readiness score and band are shown with calculation context.

-   Marketplace eligibility status is visible with consent and blocking
    reason where applicable.

5\. Feature Priorities

Priority is defined using P0/P1/P2 to keep the 3-week MVP focused. P0
items are mandatory for the demo loop. P1 items improve operational
confidence. P2 items should not block the MVP.

  ---------------------------------------------------------------------------
  **Priority**   **Meaning**     **Features**
  -------------- --------------- --------------------------------------------
  P0 / Must Have Required for    Login/profile reuse; assessment or 3-track
                 the 3-week MVP  entry; role selection/admin assignment;
                 to be           6-month roadmap; role-based course; 6E
                 considered      sequence; problem statement; artifact
                 successful.     upload; AI/rubric review; no-XP-for-failure
                                 rule; learner dashboard; readiness formula
                                 with context; marketplace eligibility status
                                 and consent blocking.

  P1 / Should    Strongly        Admin progress tracking; manual-review
  Have           recommended for queue; readiness breakdown with missing
                 controlled      evidence; configuration warnings;
                 pilot quality   resubmission guidance; governance decision
                 but not allowed IDs; learner-safe feedback summaries;
                 to derail the   controlled content upload for priority
                 P0 loop.        roles.

  P2 / Could     Post-MVP        Advanced recruiter AI matching; full mentor
  Have           enhancements or workflow; deep authoring studio;
                 future-phase    Browse/Binge mode; AI tutor chatbot; full
                 items.          media hosting; notifications; peer review;
                                 badges/streaks beyond simple XP display;
                                 multi-path exploration; advanced analytics
                                 and industry feedback loop.
  ---------------------------------------------------------------------------

6\. User Roles and Jobs-to-Be-Done

The MVP requires the following product roles. This section intentionally
avoids individual owner names and focuses only on product
responsibility.

-   Learner: Move from assessment awareness to role-readiness by viewing
    tracks, selecting or receiving a role, following a roadmap,
    completing modules, submitting evidence and viewing readiness.

-   Admin: Configure the role-course-roadmap structure, assign or
    override roles where approved, track learner progress, view artifact
    status and monitor readiness/marketplace status.

-   Mentor / Faculty / Reviewer: Support manual review where configured,
    especially for low-confidence, unreadable, disputed,
    critical-failure or retry-exhausted submissions.

-   Product / L&D / Content: Define role/course/module/problem/rubric
    quality, approve priority content, ensure 6E integrity and prevent
    content drift.

-   AI Review Layer: Evaluate evidence against approved rubrics and
    generate learner-safe feedback. AI may recommend scores and
    feedback, but the system applies status, XP, readiness and
    marketplace decisions.

-   QA: Validate the full product loop, including no stage skipping, no
    duplicate XP, no mastery without accepted artifact, no readiness
    inflation and no marketplace visibility without valid consent.

7\. End-to-End MVP Flow

The required product flow is fixed for this 3-week MVP:

1.  Login / Profile

2.  Assessment output / 3-track report

3.  Role selection or admin role assignment

4.  6-month roadmap

5.  Role-based course

6.  6E module delivery

7.  Problem statement

8.  Artifact upload

9.  AI/rubric evaluation

10. XP allocation

11. Learner dashboard update

12. Readiness score

13. Marketplace eligibility status

The learner should always understand the current step, the next action
and what evidence is needed to move forward.

8\. Functional Requirements by Flow Stage

FR1 - Login and Profile Reuse

Reuse the existing authentication, learner profile and institution
context. The MVP should not rebuild authentication.

FR2 - Assessment Output and 3-Track Entry

Connect existing Skill Ecosystem assessment outputs, AI reports and
three-track report to the LTE entry point. Learners should see
recommended tracks and roles under each track.

FR3 - Role Selection or Admin Assignment

Learners can select a target role, or an authorised admin can assign one
for the MVP demo. Any admin override must be visible and traceable.

FR4 - 6-Month Roadmap

The selected role must show a 6-month roadmap with month-wise learning
focus, courses/modules, problem tasks, artifact expectations, XP target
and readiness milestone.

FR5 - Role-Based Course

Each role-based course must be connected to a role, domain, industry,
capability target, level transition, modules, problem statements,
artifacts, rubric and XP rule.

FR6 - 6E Module Delivery

Each module must follow Engage, Explore, Explain, Express, Empower and
Evolve in sequence. No stage may be skipped in MVP.

FR7 - Problem Statement Workflow

Each module must display a real-world problem statement, expected
output, submission type, rubric summary and learner instructions.

FR8 - Artifact Upload

The learner can submit evidence through file upload, text, link,
spreadsheet, code link or approved media link as applicable to the role
and module.

FR9 - AI/Rubric Evaluation

AI/rubric review evaluates the learner artifact using approved rubric
criteria and returns score, feedback, strengths, improvement areas,
evidence found/missing, confidence and resubmission guidance.

FR10 - XP Allocation

XP is awarded deterministically by the system only after valid events.
Failed, incomplete, rejected or resubmission-required artifacts must
receive 0 XP and must not increase readiness.

FR11 - Learner Dashboard

The dashboard must be action-first and show current role, roadmap
progress, current course/module/stage, artifact status, AI feedback, XP,
readiness and marketplace status.

FR12 - Readiness Score

Readiness must use the approved five-component formula and must not use
content views or engagement XP. The score must be shown with context and
warnings where data is missing.

FR13 - Marketplace Eligibility

Marketplace status depends on readiness band, mandatory eligibility
conditions and active marketplace visibility consent. If any condition
is missing, show blocked with reason.

FR14 - Admin Tracking

Admins can manage the MVP structure, assign roles, track learner
progress, view artifact review status, see XP/readiness and monitor
marketplace eligibility.

FR15 - Learning Completion and Mastery Separation

A module may be learning-complete after all six 6E stages are complete,
but it is mastered only after the mandatory artifact is accepted.

FR16 - Product Governance and Version Safety

Capability, 6E, level, rubric, XP and readiness rules should be governed
through approved versions. Historical learner outcomes must not be
silently changed by later rule updates.

9\. 6E Learning Design Requirements

The 6E framework is a product learning rule, not a visual label. Each E
must satisfy its intended learning purpose.

-   Engage: Introduces a realistic problem, situation or challenge that
    creates relevance and curiosity.

-   Explore: Enables investigation, observation, comparison, attempt,
    questioning or discovery.

-   Explain: Provides concepts, principles, methods, models and examples
    after exploration.

-   Express: Requires the learner to communicate understanding,
    reasoning, interpretation or design through a tangible response.

-   Empower: Requires independent application through a meaningful
    performance task and performance evidence. The recommended primary
    artifact stage is Empower, pending final product/governance
    approval.

-   Evolve: Requires reflection, revision, improvement, transfer,
    adaptation or higher-complexity application. Evolve may include
    revised/transfer evidence but should not replace the primary Empower
    artifact.

+-----------------------------------------------------------------------+
| **6E Product Rule**                                                   |
|                                                                       |
| No stage is optional in MVP. Learning is measured by observable       |
| output/evidence, not by passive content viewing.                      |
+=======================================================================+
+-----------------------------------------------------------------------+

10\. Artifact Evidence and AI Review Requirements

10.1 Artifact Evidence

Artifacts are the proof of learning. A module may be learning-complete
after all six stages are completed, but it is not mastered until the
required artifact is accepted.

-   Supported MVP evidence includes PDF, DOC/DOCX, PPT, image, text
    response, spreadsheet, Google Drive link, video/audio URL and code
    link where role-relevant.

-   Artifact workflow should use clear learner-friendly statuses: Draft,
    Submitted, Under Review, Resubmission Required, Manual Review and
    Accepted.

-   The status Rejected should not be used in the MVP learner workflow
    unless leadership separately approves a hard-invalid case such as
    unsafe content, fraudulent evidence or unrelated submission.

-   All attempts remain part of the learner history, but only the latest
    accepted submission becomes the official mastery evidence.

10.2 AI/Rubric Review

AI review should evaluate evidence against the approved rubric and
produce learner-safe feedback. AI can recommend but must not directly
assign XP, readiness or marketplace status.

-   AI may return criterion-level scores, overall score, evidence found,
    evidence missing, strengths, improvement areas, confidence,
    critical-failure flag and resubmission guidance.

-   The system applies the outcome threshold, artifact status, XP rule,
    readiness rule and marketplace rule.

-   Critical failure overrides numeric score.

-   Manual review is mandatory for low confidence, unreadable artifact,
    ambiguous interpretation, safety/compliance concern, AI retry
    failure, learner dispute or two failed resubmissions.

-   Initial failed evaluation should result in Resubmission Required
    unless a manual-review condition applies.

11\. XP Rules and Readiness Impact

XP must support motivation and progression, but it must not reward
failure or inflate readiness without evidence.

11.1 Evidence-Bearing XP

Evidence-bearing XP can contribute to readiness when it comes from
approved learning and evidence events. For MVP, use the following
product rule:

-   Completed 6E stage: +1.

-   Practice artifact accepted: +2.

-   Final artifact accepted on attempt 1: +20.

-   Final artifact accepted on attempt 2: +15.

-   Final artifact accepted on attempt 3: +10.

-   Fallback/manual evaluation accepted: +5.

-   Course completed on time: +10, only when completion rules are met.

-   Fast-track capability completion: +15 one-time per approved
    capability, only if configured and approved.

11.2 Failed Attempt Rule

+-----------------------------------------------------------------------+
| **Mandatory Product Correction**                                      |
|                                                                       |
| Failed artifacts, failed evaluations, incomplete evidence, rejected   |
| evidence and resubmission-required attempts receive 0 XP. They are    |
| tracked for feedback, retry count, learner support and audit only.    |
| They must not increase readiness.                                     |
+=======================================================================+
+-----------------------------------------------------------------------+

11.3 Engagement XP

Engagement XP may support motivation but must not contribute to
readiness. Examples include daily login, profile completion, streaks,
legacy bonus, promotional XP and readiness milestone celebration XP.

-   Store evidence-bearing XP separately from engagement XP.

-   Only evidence-bearing XP contributes to the XP Achievement component
    of readiness.

-   Engagement XP contributes zero to readiness.

-   The same event cannot award XP twice.

-   Revisiting content does not award additional XP.

12\. Readiness Formula and Marketplace Eligibility

12.1 Approved MVP Readiness Formula

+-----------------------------------------------------------------------+
| **Readiness Score Formula**                                           |
|                                                                       |
| Readiness Score = Course Completion x 30% + Artifact Completion x     |
| 25% + AI Average Score x 25% + Evidence-Bearing XP Achievement x      |
| 10% + Profile Completion x 10%                                        |
+=======================================================================+
+-----------------------------------------------------------------------+

12.2 Component Rules

-   Course Completion: Based on mastered modules compared with required
    modules.

-   Artifact Completion: Based on accepted mandatory artifacts compared
    with required mandatory artifacts.

-   AI Average Score: Based only on accepted evaluation scores.
    Under-review or missing evaluations do not count as accepted.

-   XP Achievement: Based only on evidence-bearing earned XP compared
    with expected evidence XP for the current path, capped at 100%.

-   Profile Completion: Based on required profile fields completed.

12.3 Missing-Score Handling

-   No artifact submitted: Artifact Completion is 0.

-   Artifact submitted but under review: Artifact Completion is 0 and AI
    score is not counted yet.

-   No accepted AI score: AI component is 0.

-   No expected XP configured: XP component is 0 and a configuration
    warning is shown.

-   Profile incomplete: Use actual profile-completion percentage.

-   Manual evaluation override: Use the approved manual score and keep
    the previous value in audit history.

12.4 Readiness Display

The learner dashboard must show more than a score. It must show the
readiness band, last calculated date, current role/path, missing
evidence, configuration warnings and what can improve the score. Use
whole-number score display and avoid false precision.

-   0-39: Not Ready.

-   40-59: Learning in Progress.

-   60-79: Internship Ready.

-   80-100: Job Ready.

12.5 Marketplace Eligibility

Marketplace eligibility and marketplace visibility are separate. A
learner may become eligible by score, but cannot be visible externally
unless all mandatory conditions and consent are satisfied.

-   Target role exists.

-   Mandatory profile fields are complete.

-   At least one artifact is accepted.

-   No unresolved critical-failure evaluation exists.

-   Learner account is active.

-   Marketplace visibility consent is active and valid for the current
    version/scope.

-   If any condition is missing, show blocked with the exact reason.

13\. Learner Dashboard Experience

The dashboard should reduce confusion and always make the next step
clear.

-   Next Action: Start course, continue module, submit artifact, review
    feedback, resubmit or improve readiness.

-   Current Role: Role, industry, domain and selected track.

-   Roadmap: 6-month roadmap progress and current milestone.

-   Course Progress: Current course, module progress, locked/unlocked
    modules and learning-complete versus mastered status.

-   6E Progress: Current stage and completion status.

-   Artifact Status: Draft, Submitted, Under Review, Resubmission
    Required, Manual Review or Accepted.

-   AI Feedback: Latest score, confidence, evidence found/missing and
    learner-safe feedback.

-   XP: Evidence-bearing XP, engagement XP, total XP and next milestone.

-   Readiness: Score, band, last calculated date, current path, missing
    evidence, warnings and improvement actions.

-   Marketplace: Eligibility status, consent status and blocked reason
    where applicable.

14\. MVP Product Operations and Governance Requirements

This section replaces the previous "Admin and Governance Product
Requirements" heading. The intent is to describe product operations and
governance controls without turning the PRD into a technical
specification.

-   Upload or manage industries, domains and roles for the MVP taxonomy.

-   Map roles to courses and the 6-month roadmap.

-   Upload course/module/problem/rubric content for controlled priority
    courses.

-   Apply approved XP and readiness rules; do not freely edit frozen
    rules inside the MVP.

-   Assign roles or override learner role selection with reason and
    traceability.

-   Track learner progress, artifact status, AI review status, XP,
    readiness and marketplace eligibility.

-   Provide manual review flow for low-confidence, disputed, unreadable,
    critical-failure or retry-exhausted artifacts.

-   Maintain product governance for capabilities, 6E meanings,
    proficiency levels, rubrics and version changes at a product
    decision level.

-   Governance changes must not silently mutate already completed
    learner submissions, XP, readiness or marketplace outcomes.

15\. Content Architecture and Upload Strategy

The MVP should make the LTE structure visible while keeping deep content
build controlled. The product hierarchy is: Industry -\> Domain -\> Role
-\> Role-Based Course -\> Module -\> 6E Stage -\> Problem -\> Artifact
-\> AI/Rubric Review -\> XP/Readiness.

-   Upload the visible taxonomy and role shells to show the product
    architecture.

-   Deep-build only a priority content set for the 3-week demo.

-   Priority courses should have complete module flow, 6E structure,
    problem statement, artifact requirement and rubric.

-   At least one complete learner artifact path must work end to end.

-   Governance-controlled capability, 6E and level definitions must be
    reused rather than recreated by AI.

-   Any change to capability meaning, 6E meaning, level meaning, rubric
    standard or XP/readiness rule requires approval and version
    traceability.

16\. Consent, Privacy and Marketplace Visibility

Marketplace visibility consent is mandatory because eligible learners
may become visible outside the learning flow.

-   Store consent status.

-   Store consent version.

-   Store consented date/time.

-   Store withdrawn date/time when applicable.

-   Store visibility scope, such as internship, job, project or
    recruiter visibility.

-   If consent is missing, expired, withdrawn or version-mismatched,
    marketplace visibility must be blocked even when readiness score
    qualifies.

-   Consent withdrawal must stop marketplace visibility and preserve
    prior audit history.

17\. Risks

The following risks should be reviewed before development starts and
during weekly MVP checkpoints.

  --------------------------------------------------------------------------------
  **Risk**          **Impact**           **Mitigation**
  ----------------- -------------------- -----------------------------------------
  Failure XP        Learners may appear  Freeze rule:
  confusion         to progress or       failed/incomplete/resubmission-required
                    improve readiness    artifacts receive 0 XP and never increase
                    without successful   readiness.
                    evidence.            

  Readiness false   Dashboard score may  Show band, last calculated date, current
  precision         appear more accurate path, missing evidence, configuration
                    than available       warnings and improvement actions.
                    evidence supports.   

  6E artifact-stage Engineering may      Use approved decision record; until
  ambiguity         hard-code the wrong  approved, keep artifact status separate
                    artifact trigger.    from 6E stage completion.

  Content/rubric    Week 2 artifact and  Freeze priority roles, problem statements
  delay             AI/rubric review may and rubrics before Week 2 starts.
                    be blocked.          

  AI review         Low-confidence or    Use manual/rubric fallback and mandatory
  unreliability     unreadable           manual review conditions.
                    submissions may      
                    produce unstable     
                    feedback.            

  Marketplace       Learner may be       Block visibility unless active versioned
  consent gap       exposed externally   consent and scope are present.
                    without valid        
                    consent.             

  Scope creep into  3-week MVP may       Keep School Showcase and advanced
  School Showcase   become too large and recruiter matching out of scope unless
  or advanced       miss core demo loop. separately approved.
  recruiter flow                         

  Taxonomy          Too much             Upload shells for visibility; deep-build
  overbuild         taxonomy/content     only priority courses needed for the
                    work may delay the   demo.
                    learner loop.        
  --------------------------------------------------------------------------------

18\. Dedicated Out-of-Scope

The following items are not part of the 3-week LTE MVP. They should not
block P0 delivery unless leadership formally changes scope.

-   School Showcase / Beyond Marks Grade 6-8 learner report, parent
    insight and school dashboard flow.

-   Advanced recruiter AI matching, ranking, shortlist scoring or
    recommendation beyond deterministic marketplace eligibility status.

-   Full mentor/faculty workflow, except limited manual review required
    for MVP demo safety.

-   Deep authoring studio and unrestricted runtime editing of frozen
    XP/readiness/eligibility rules.

-   Full video/audio hosting; URL submission is the MVP fallback.

-   Browse/Binge mode, multi-path exploration and role comparison beyond
    the selected/assigned MVP role.

-   AI tutor chatbot, peer mentorship, notifications, discussion forums
    and learning repository.

-   Advanced gamification such as badges, streak economy, XP
    spending/unlocks and rewards beyond simple display.

-   Industry feedback loop, advanced analytics and long-term placement
    outcome tracking.

-   AI-created or AI-reinterpreted capability definitions, 6E meanings,
    proficiency levels, evidence standards or course-capability mappings
    without governance approval.

19\. QA and Acceptance Criteria

19.1 Learner Acceptance

-   Learner can log in and see profile context.

-   Learner can view assessment-based tracks and role options.

-   Learner can select or receive a role.

-   Learner can view 6-month roadmap.

-   Learner can start a course and open modules.

-   Learner can complete 6E stages in sequence.

-   Learner can view problem statement and rubric guidance.

-   Learner can submit artifact evidence.

-   Learner can receive AI/rubric feedback.

-   Learner can receive valid XP only for approved events.

-   Learner can view dashboard, readiness and marketplace status.

19.2 Product Logic Acceptance

-   No 6E stage skipping.

-   No learning-complete state until all six 6E stages are complete.

-   No mastered state until all six stages are complete and mandatory
    artifact is accepted.

-   No XP for failed, incomplete or resubmission-required artifacts.

-   No duplicate XP for the same event.

-   Readiness uses the approved formula only.

-   Readiness excludes engagement XP and failed attempts.

-   Critical failure overrides numeric score.

-   Manual review is triggered under the approved manual-review
    conditions.

-   Marketplace status reflects both score and mandatory conditions,
    including consent.

-   Dashboard metrics are based on actual progress and evidence, not
    content views.

20\. Product Decisions to Freeze Before Coding

These product decisions should be frozen before implementation starts or
before the relevant module is coded.

-   Module mastery rule: Mastered only after all six 6E stages are
    complete and mandatory artifact is accepted.

-   Artifact workflow: Use Draft, Submitted, Under Review, Resubmission
    Required, Manual Review and Accepted for MVP. Do not use Rejected
    unless approved as a hard-invalid status.

-   6E artifact decision: Recommended primary mandatory artifact stage
    is Empower; Evolve is for reflection, revision, improvement,
    transfer, adaptation or higher-complexity application.

-   AI review rule: AI evaluates and recommends; the system applies
    status, XP, readiness and marketplace decisions.

-   Manual review rule: Initial failure becomes Resubmission Required
    unless a manual-review condition applies. Manual review is mandatory
    after two failed resubmissions or any frozen manual-review
    condition.

-   XP rule: No XP for failed attempts. Evidence-bearing XP and
    engagement XP remain separate. Only evidence-bearing XP contributes
    to readiness.

-   Readiness formula: Course Completion 30%, Artifact Completion 25%,
    AI Average Score 25%, Evidence-Bearing XP 10%, Profile Completion
    10%.

-   Marketplace consent rule: Eligibility is not visibility. Active
    versioned consent is mandatory before recruiter/marketplace
    visibility.

21\. Sign-Off and Change Control

The following sign-offs are required before this PRD is treated as
frozen for implementation:

  -------------------------------------------------------------------------
  **Role**                 **Name**            **Approval**   **Date**
  ------------------------ ------------------- -------------- -------------
  Product Lead             Karthik             Pending        

  Technical Lead           To be confirmed     Pending        

  L&D / Content Owner      To be confirmed     Pending        

  Rareminds CEO / Business Subashini Maam      Pending        
  Sign-Off                                                    
  -------------------------------------------------------------------------

Any change to 6E progression, artifact workflow, AI review thresholds,
XP rules, readiness formula, marketplace bands, consent rules or product
scope requires written approval and version control.

Reference Sources Used

-   LTE MVP Frozen Product Rules for Engineering Handover v1.0.

-   LTE Product Specification Final v2.

-   LTE MVP Build Document and 3-Week Briefing Deck.

-   Rareminds Skill Ecosystem BRD Revisited.

-   Resource Studio PRD reference.

-   LTE 3-Week MVP PRD v3.3 AI Review Flow Decision Integrated.

-   Product-only clean PRD formatted version.
