**LTE 3-Week MVP PRD\
**

Source: LTE_3_Week_MVP_PRD_v3.3_AI_Review_Flow_Decision_Integrated

  --------------------------------------------------------------------------------------------------
  **Flow Stage**         **System Input**                                     **System Output / Data
                                                                              Created**
  ---------------------- ---------------------------------------------------- ----------------------
  Login / Profile        Existing auth, learner profile, institution context  Authenticated learner
                                                                              session and profile
                                                                              status

  Assessment output /    Skill Ecosystem assessment report, AI report,        Track cards, role
  3-track report         3-track output                                       options and report
                                                                              summary

  Role selection or      Recommended tracks, roles under track, admin         Learner-role mapping
  admin assignment       override                                             with active status

  6-month roadmap        Role, domain, capability requirement, course shell   Roadmap with
                                                                              month-wise milestones,
                                                                              courses, modules and
                                                                              artifacts

  Role-based course      Learning path and role-course mapping                Course page with
                                                                              module list and next
                                                                              action

  6E module delivery     Approved capability ID, target proficiency level,    Governed
                         fixed 6E definition, module content and governance   stage-by-stage
                         versions                                             progression with
                                                                              canonical
                                                                              capability/level
                                                                              references and
                                                                              validation status

  Problem statement      Module problem/task and rubric                       Learner knows task,
                                                                              expected output and
                                                                              submission type

  Artifact upload        File/link/text/code/video/spreadsheet/PPT/PDF/DOCX   Artifact submission
                                                                              record with status

  AI evaluation          Artifact, approved rubric/version,                   Criterion-level
                         module/role/capability IDs, target level, evidence   scores, evidence
                         requirement and governance versions                  found/missing,
                                                                              feedback, strengths,
                                                                              improvement areas,
                                                                              confidence,
                                                                              critical-failure flag
                                                                              and evaluation-outcome
                                                                              recommendation; the
                                                                              system applies
                                                                              artifact status, XP
                                                                              and readiness

  XP allocation          Valid completion/submission/evaluation event         XP event recorded;
                                                                              duplicate XP blocked

  Learner dashboard      Progress, XP, artifact and AI status                 Dashboard progress
  update                                                                      cards updated

  Readiness score        Course mastery, accepted mandatory artifacts,        Frozen readiness
                         accepted AI scores, evidence-bearing XP and profile  score, component
                         completion                                           breakdown and band

  Marketplace            Readiness score and evidence requirements            not_ready /
  eligibility status                                                          learning_in_progress /
                                                                              internship_ready /
                                                                              job_ready / blocked,
                                                                              including the blocking
                                                                              reason
  --------------------------------------------------------------------------------------------------

# 7. LTE Core Product Logic and Validation Questions

The final LTE logic is: Assessment capability level -\> Target role
requirement -\> Gap engine -\> Course recommendation -\> Problem solving
-\> Evidence -\> XP -\> Role readiness -\> Opportunity matching. Every
feature in the MVP should support this logic.

  -----------------------------------------------------------------------
  **Validation Question**             **Expected Answer in MVP**
  ----------------------------------- -----------------------------------
  Which role is the learner           Selected Assessment role is stored
  targeting?                          and visible

  Which capability is missing?        Capability gap engine identifies
                                      missing/target levels where data is
                                      available

  What is the learner current level?  Derived from assessment output or
                                      default baseline

  What is the required level?         Loaded from role-capability mapping

  Which course bridges the next level Course mapped to capability and
  transition?                         level_from -\> level_to

  What problem proves mastery?        Problem statement is linked to
                                      module/artifact

  What evidence is submitted?         Artifact submission record exists

  What XP/level update happens after  XP event and readiness update
  completion?                         recorded

  Which approved capability is being  Capability ID, canonical name,
  developed?                          definition, observable behaviours
                                      and evidence intent are retrieved
                                      from the Capability Master.

  What proficiency level is targeted? Target level and allowed support
                                      are retrieved from the approved
                                      course-module-capability mapping
                                      and fall within the capability
                                      level range.

  Does the activity truly satisfy its Fixed 6E purpose, prohibited
  6E label?                           interpretation and minimum
                                      completion event are validated
                                      before publication.

  Which governance versions produced  Capability, 6E, level, course
  this task?                          architecture and rubric versions
                                      are stored and remain auditable.
  -----------------------------------------------------------------------

## 8.1 Frozen Module State Model

  -----------------------------------------------------------------------
  **State**                           **Definition**
  ----------------------------------- -----------------------------------
  not_started                         Learner has not entered the module.

  in_progress                         Learner has started one or more 6E
                                      stages.

  learning_complete                   All six 6E stages are completed.

  artifact_submitted                  Mandatory final artifact has been
                                      submitted.

  under_review                        Artifact is awaiting AI or manual
                                      evaluation.

  resubmit_required                   Artifact has not met the acceptance
                                      criteria.

  accepted                            Artifact has passed the evaluation
                                      threshold.

  mastered                            All six stages are complete and the
                                      artifact is accepted.
  -----------------------------------------------------------------------

Mastery Formula\
learning_complete = all_6e_stages_completed\
mastered = all_6e_stages_completed AND artifact_status = accepted\
A learner may finish all learning stages before evaluation. Submission
completes the learning activity but does not prove mastery.

## 8.2 Frozen 6E Progression and Persistence Rules

> • All six stages are mandatory and must be completed in sequence:
> Engage, Explore, Explain, Express, Empower and Evolve.
>
> • The next stage unlocks only after the current stage completion
> condition is met.
>
> • Stage completion is stored independently and persists across refresh
> and resume.
>
> • Completion cannot be based only on opening or viewing a page.
>
> • Admin override is allowed only for authorised Rareminds
> administrators and must be audit-logged.
>
> • stage_N unlocks only when stage_N-1 = completed.

  -----------------------------------------------------------------------
  **6E Stage**                        **Governed Minimum Completion
                                      Event**
  ----------------------------------- -----------------------------------
  Engage                              Learner acknowledges the realistic
                                      problem, situation or challenge and
                                      its relevance.

  Explore                             Learner completes an investigation,
                                      observation, comparison, attempt,
                                      question or discovery response.

  Explain                             Learner completes the required
                                      concept clarification, method,
                                      model, worked example or knowledge
                                      check after exploration.

  Express                             Learner communicates understanding,
                                      reasoning, interpretation or design
                                      through a structured tangible
                                      response.

  Empower                             Learner independently completes the
                                      meaningful performance task and
                                      produces the required performance
                                      evidence. Under the recommended
                                      mapping pending Decision ID
                                      6E-ARTIFACT-TRIGGER-001, the
                                      primary mandatory artifact is
                                      submitted in Empower.

  Evolve                              Learner completes reflection,
                                      revision, improvement, transfer,
                                      adaptation or higher-complexity
                                      application; revised/transfer
                                      evidence may be stored separately.
  -----------------------------------------------------------------------

## 8.3 Authoritative 6E Pedagogical Intent and Prohibited Interpretations

  -----------------------------------------------------------------------
  **6E Stage**            **Fixed Purpose**       **Must Not Be
                                                  Interpreted As**
  ----------------------- ----------------------- -----------------------
  Engage                  Introduce a realistic   A generic welcome,
                          problem, situation or   agenda or course
                          challenge that creates  introduction.
                          relevance and           
                          curiosity.              

  Explore                 Enable learners to      A long theoretical
                          investigate, observe,   reading or lecture.
                          compare, attempt,       
                          question or discover.   

  Explain                 Provide concepts,       Repetition of the
                          principles, methods,    activity without
                          models and worked       conceptual clarity.
                          examples after          
                          exploration.            

  Express                 Require learners to     A simple recall-only
                          communicate their       multiple-choice
                          understanding,          question.
                          reasoning,              
                          interpretation or       
                          design.                 

  Empower                 Require independent     More guided practice
                          application through a   without learner
                          meaningful performance  ownership.
                          task and artifact.      

  Evolve                  Require reflection,     A course conclusion,
                          improvement, transfer,  satisfaction survey or
                          adaptation or           generic feedback form.
                          higher-complexity       
                          application.            
  -----------------------------------------------------------------------

Recommended Authoritative Interpretation - Pending Written Product and
Governance Approval\
The recommended primary mandatory module performance artifact stage is
Empower. Evolve is reserved for reflection, revision, improvement,
transfer, adaptation or higher-complexity application and may produce a
revised artifact or separately configured capstone/transfer deliverable.
Until Decision ID 6E-ARTIFACT-TRIGGER-001 is approved, engineering must
not hard-code the stage-to-artifact trigger. Artifact workflow states
must remain separate from 6E stage states.

## 8.4 Capability as a Formal Data Object

AI must not freely create or rewrite capability names. Every approved
capability must exist in a controlled Capability Master.

  -----------------------------------------------------------------------
  **Field**                           **Example / Required Meaning**
  ----------------------------------- -----------------------------------
  Capability ID                       CAP-CIV-004

  Capability Name                     Site Measurement and Quantity
                                      Estimation

  Canonical Definition                Ability to interpret drawings,
                                      measure site quantities, calculate
                                      material requirements and document
                                      estimates accurately.

  Observable Behaviours               Measures quantities, records
                                      dimensions, calculates totals and
                                      identifies variances.

  Required Evidence                   Measurement sheet, BOQ extract and
                                      calculation workbook.

  Related Skills                      Drawing interpretation, arithmetic
                                      and documentation.

  Approved Level Range                L1-L4

  Prohibited Interpretation           General mathematical ability or
                                      theoretical estimation knowledge.
  -----------------------------------------------------------------------

AI may contextualise a capability for a course or industry, but it must
not alter the capability ID, canonical name, definition, evidence intent
or approved level progression.

## 8.5 Fixed Learning Hierarchy

Capability -\> Competency -\> Skill -\> Task -\> Evidence

  -----------------------------------------------------------------------
  **Layer**               **Meaning**             **Example**
  ----------------------- ----------------------- -----------------------
  Capability              Broad, observable       Manage
                          ability that combines   construction-site
                          knowledge, skill and    quality.
                          judgement.              

  Competency              A coherent component of Conduct concrete
                          a capability.           quality checks.

  Skill                   A specific action that  Interpret slump-test
                          can be practised.       results.

  Task                    The work the learner    Perform and record a
                          must perform.           slump test.

  Evidence                The artifact that       Observation sheet and
                          proves performance.     decision note.

  Knowledge               Concepts, rules and     Acceptable ranges,
                          procedures needed to    method and safety
                          perform.                requirements.
  -----------------------------------------------------------------------

A module teaches knowledge and skills. A task demonstrates skill. A
combination of skills, decisions and evidence demonstrates capability.

## 8.6 Proficiency Levels Through Observable Performance

  -----------------------------------------------------------------------
  **Level**               **Canonical Meaning**   **Performance Signal**
  ----------------------- ----------------------- -----------------------
  L1 - Awareness          Recognises concepts,    Identify, describe,
                          terminology, tools,     recognise or explain.
                          risks and expected      
                          procedures.             

  L2 - Guided Application Performs a routine task Complete with
                          with instructions,      structured support.
                          templates, examples or  
                          supervision.            

  L3 - Independent        Completes the task      Produce a complete
  Performance             independently and       output without
                          handles routine         step-by-step guidance.
                          variations.             

  L4 - Applied Judgement  Diagnoses problems,     Justify choices,
                          makes decisions,        resolve variance and
                          improves outputs and    optimise.
                          handles non-routine     
                          situations.             

  L5 - Transfer and       Adapts capability to    Transfer, coach,
  Leadership              new contexts, guides    standardise or
                          others and improves     redesign.
                          systems.                
  -----------------------------------------------------------------------

Task difficulty alone does not determine the level. The level is
determined by independence, complexity, variation, judgement, quality of
evidence and transfer.

## 8.7 Mandatory Capability-6E-Level Control Matrix

  --------------------------------------------------------------------------------------------
  **Capability   **Module**   **6E**     **Task**     **Evidence**   **Target   **Allowed
  ID**                                                               Level**    Support**
  -------------- ------------ ---------- ------------ -------------- ---------- --------------
  CAP-CIV-004    Module 1     Engage     Review an    Observation    L1         Full guidance
                                         inaccurate   note                      
                                         BOQ.                                   

  CAP-CIV-004    Module 1     Explore    Compare      Comparison     L1-L2      Guided
                                         quantities   sheet                     
                                         with a                                 
                                         drawing.                               

  CAP-CIV-004    Module 1     Empower    Prepare a    BOQ sheet      L2         Template
                                         quantity                               allowed
                                         estimate.                              

  CAP-CIV-004    Module 2     Empower    Revise an    Revised BOQ    L3         No
                                         estimate     and rationale             step-by-step
                                         after a site                           guidance
                                         variation.                             

  CAP-CIV-004    Capstone     Evolve     Optimise an  Final BOQ and  L4         Independent
                                         estimate for decision                  
                                         a new        report                    
                                         project.                               
  --------------------------------------------------------------------------------------------

This matrix must be approved before module generation. It prevents
accidental repetition and ensures that the same capability grows in
independence and complexity across modules. An Evolve capstone row is
valid only when it represents transfer, adaptation, improvement or
higher-complexity application and does not replace the module Empower
artifact.

## 9.2.1 AI Score Meaning

  -----------------------------------------------------------------------
  **Criterion Score**                 **Meaning**
  ----------------------------------- -----------------------------------
  0                                   Missing, unsafe or fundamentally
                                      incorrect

  1                                   Weak, incomplete or unsupported

  2                                   Acceptable but improvement required

  3                                   Complete, accurate, role-safe and
                                      workplace usable
  -----------------------------------------------------------------------

## 9.2.2 Evaluation Outcome Thresholds and Mastery Impact

  ---------------------------------------------------------------------------
  **Evaluation      **Evaluation        **Artifact Workflow **Mastery
  Score**           Outcome**           Status**            Impact**
  ----------------- ------------------- ------------------- -----------------
  0-49              fail                resubmit_required   Not mastered

  50-69             revision_required   resubmit_required   Not mastered

  70-84             accepted            accepted            Mastered

  85-100            accepted_strong     accepted            Mastered

  Critical failure  critical_failure    resubmit_required   Not mastered
                                        or manual_review    

  Low confidence    uncertain           manual_review       Pending
  ---------------------------------------------------------------------------

## 9.2.3 Critical Failure, Manual Review and Resubmission Rules

> • Any critical failure overrides the numeric score.
>
> • Critical-failure examples include unsafe decisions, action beyond
> role authority, fabricated evidence, ignored unresolved risk, missing
> mandatory evidence or a prohibited recommendation.
>
> • Manual review is mandatory when confidence_score \< 0.70, the
> artifact cannot be read reliably, interpretation is ambiguous,
> safety/compliance is detected, AI retries fail or the learner disputes
> the result.
>
> • Maximum MVP resubmissions: 2. After two failed resubmissions, route
> the artifact to manual review.
>
> • The latest accepted submission becomes the official score; all
> earlier submissions remain in the audit history.
>
> • critical_fail = true -\> resubmit_required OR manual_review;
> confidence_score \< 0.70 -\> manual_review_required = true.

## 9.3 XP Rules for MVP

## 9.3.1 Evidence-Bearing XP (Contributes to Readiness)

Readiness Calculation Boundary\
Only evidence-bearing XP contributes to readiness. Engagement, reward,
milestone and promotional XP must be recorded separately and must never
increase readiness.

Frozen decision: XP is assigned deterministically by the system. AI
provides scores and feedback only. XP is awarded only for valid system
events. Evidence-bearing XP and engagement XP are separate categories,
and only evidence-bearing XP contributes to readiness.

  -----------------------------------------------------------------------
  **Evidence-Bearing Event            **XP**
  (Contributes to Readiness)**        
  ----------------------------------- -----------------------------------
  Each completed 6E stage             +1

  Practice artifact - Pass (1st)      +2

  Final artifact - Pass (Attempt 1)   +20

  Final artifact - Pass (Attempt 2)   +15

  Final artifact - Pass (Attempt 3)   +10

  Fallback evaluation - Pass          +5

  Course completed on time            +10

  Fast Track completion (approved     +15 one-time/capability
  capability completion)              

  Capstone XP and other approved      Configured approved value
  capability-completion XP            
  -----------------------------------------------------------------------

## 9.3.2 Engagement & Consistency XP (Excluded from Readiness)

These events support engagement, participation and rewards. They are
tracked separately and must not be included in readiness calculations.

  -----------------------------------------------------------------------
  **Engagement / Reward Event         **XP**
  (Excluded from Readiness)**         
  ----------------------------------- -----------------------------------
  Daily active login                  +1/day

  Profile completion                  +50

  7-day streak                        +5

  30-day consistency                  +30

  25% Readiness milestone             +10

  50% Readiness milestone             +20

  75% Readiness milestone             +30

  100% Readiness milestone            +100

  Legacy consistency bonus            +20 one-time

  Promotional XP                      As configured

  Practice artifact - Fail (1st)      +1

  Fallback evaluation - Fail          +1

  Final artifact - Fail               +1 per attempt
  -----------------------------------------------------------------------

## 9.3.3 XP Integrity and Separation Rules

> • XP is awarded only for valid system events.
>
> • The same event cannot award XP twice.
>
> • Revisiting content does not award additional XP.
>
> • Failure XP is not acceptance XP; failed or incomplete artifacts do
> not receive acceptance XP.
>
> • AI recommendations must never directly modify XP.
>
> • Evidence-bearing XP and engagement XP must be stored as separate
> categories.
>
> • Readiness calculations include only xp_category = evidence and
> exclude xp_category = engagement.
>
> • Deterministic deduplication key: unique_event_reference =
> learner_id + source_type + source_id.

## 9.4 AI Governance and Three-Layer Control

AI may generate context, examples, cases, explanations and task
scenarios. It must not generate or reinterpret capability definitions,
6E meanings, proficiency levels, progression rules or evidence
standards.

## Mandatory AI instruction

Mandatory AI instruction \| Do not redefine capability names, capability
definitions, 6E definitions or proficiency levels. Retrieve and use the
exact approved values from the supplied master tables. Where a required
value is unavailable, return \"MISSING GOVERNANCE INPUT\" instead of
creating a new interpretation.

## 9.4.1 Layer 1 - Generation Control

The generation model receives the Capability Dictionary, 6E Dictionary,
Level Dictionary, course capability map, approved output schema and
prohibited interpretations.

## 9.4.2 Layer 2 - Semantic Validation AI

A separate validation call checks whether the activity truly matches the
selected capability, 6E stage, level, evidence and progression. It
returns errors and must not silently rewrite the module.

## 9.4.3 Layer 3 - Deterministic System Validation

Engineering enforces rule-based checks that do not depend on AI
judgement.

  -----------------------------------------------------------------------
  **Rule**                            **System Action**
  ----------------------------------- -----------------------------------
  Capability ID is not in the         Reject.
  Capability Master.                  

  Level falls outside the approved    Reject.
  capability level range.             

  Empower contains no artifact or     Reject.
  performance evidence.               

  Evolve contains no reflection,      Reject.
  transfer, adaptation or             
  improvement.                        

  L3 task provides full step-by-step  Flag for review.
  guidance.                           

  L4 task contains no judgement,      Flag for review.
  diagnosis or decision.              

  Module uses a capability not mapped Reject.
  to the course.                      

  Capability name differs but ID is   Replace display name with canonical
  identical.                          name and log the variance.
  -----------------------------------------------------------------------

# 11. Admin Dashboard, Authoring and Content Upload

  ----------------------------------------------------------------------------------------
  **Admin Module**                    **MVP Requirement**
  ----------------------------------- ----------------------------------------------------
  Taxonomy Upload                     Upload industries, domains and roles

  Role-Course Mapping                 Map role to course and 6-month roadmap

  Course Upload                       Course name, description, capability, level_from,
                                      level_to, role, industry, domain

  Module Upload                       Module sequence, 6E stage data, objective,
                                      resources, problem statement, artifact requirement

  Problem Statement Upload            Problem title, scenario, task instructions, expected
                                      output, submission type

  Rubric Upload                       Create approved version-controlled rubrics with
                                      criterion definitions, score bands, critical-failure
                                      rules, confidence/manual-review rules and feedback
                                      guidance

  XP Rule Setup                       View/apply approved frozen XP configuration only;
                                      any value change requires product change request,
                                      approval and a new configuration version

  Role Assignment                     Assign role manually or override learner selection

  Progress Tracking                   View
                                      course/module/artifact/AI/XP/readiness/marketplace
                                      status

  Audit                               Track content/rubric versions, role assignment,
                                      artifact attempts, evaluation outputs, manual
                                      review, XP events, readiness snapshots, consent and
                                      every override

  Manual Review Queue                 Review low-confidence, unreadable, disputed,
                                      critical-failure or retry-exhausted artifacts;
                                      record reviewer identity and decision

  Consent Management                  View marketplace visibility consent status, version,
                                      consented_at, withdrawn_at and visibility scope

  Configuration Health                Show missing expected XP, missing mappings, invalid
                                      thresholds and readiness/eligibility configuration
                                      warnings

  Capability Master                   Create/view approved capability ID, canonical name,
                                      definition, observable behaviours, required
                                      evidence, related skills, approved level range and
                                      prohibited interpretation.

  6E Definition Master                Maintain fixed purpose, prohibited interpretation
                                      and minimum completion rule for each Vidya Setu 6E
                                      stage.

  Level & Complexity Master           Maintain L1-L5 canonical meanings, performance
                                      signals, allowed support and
                                      independence/complexity/judgement/transfer rules.

  Course-Module-Capability Mapping    Map approved capability IDs, target levels and
                                      allowed support to courses/modules before
                                      generation.

  Capability-6E-Level Matrix          Approve task, evidence, target level and allowed
                                      support for every module and capstone row before
                                      generation.

  Task-Evidence-Rubric Mapping        Map permanent task, evidence and rubric IDs to
                                      capability, stage and level.

  Anchor Example Library              Maintain approved, borderline and rejected examples
                                      for every 6E stage and proficiency level.

  Governance Version Register         Version and audit the Capability Dictionary, 6E
                                      Framework, Level Framework, Course Architecture and
                                      Rubric Standard.

  Semantic Validation Queue           Review semantic-validation errors without permitting
                                      silent AI rewrite.

  Governance Approval & Publish       Require authorised human governance approval after
                                      deterministic and semantic validation and before
                                      publish.
  ----------------------------------------------------------------------------------------

## 11.1 AI vs System Responsibility

  -----------------------------------------------------------------------
  **Decision**            **AI Responsibility**   **System
                                                  Responsibility**
  ----------------------- ----------------------- -----------------------
  Criterion score         Recommend               Validate and store

  Overall weighted score  May return calculated   Recalculate
                          value                   deterministically

  Critical failure        Detect and explain      Apply outcome rule

  Artifact acceptance     Recommend from rubric   Apply threshold and
                                                  status

  XP                      No authority            Assign using fixed
                                                  rules

  Readiness               No authority            Calculate using
                                                  approved formula

  Marketplace band        No authority            Assign using approved
                                                  thresholds and
                                                  conditions

  Manual review           Recommend               Route and record

  Feedback                Generate                Store and display
  -----------------------------------------------------------------------

## 11.2 Governance Authoring and Approval Controls

Only authorised Learning Technology and Engineering Governance owners
may approve or version capability, 6E, level, course-architecture,
evidence and rubric standards. Content creators and AI may propose
contextualisation, but publication requires deterministic validation,
semantic validation and human governance approval. Every change must
retain prior versions and approval history.

# 12. Content Architecture, Capability Governance and Upload Strategy

The governed content hierarchy is Industry -\> Domain -\> Role -\>
Role-based course -\> Module -\> Capability -\> Competency -\> Skill -\>
Task -\> Evidence -\> Rubric -\> AI evaluation -\> XP/readiness. The MVP
should upload the full taxonomy, but deep-build a priority content set.
Every lower layer inherits approved governance values from the layer
above.

  -----------------------------------------------------------------------
  **Content Level**       **3-Week Requirement**  **Scale Strategy**
  ----------------------- ----------------------- -----------------------
  Industries              Upload 32 industry      Full taxonomy visible
                          shells                  

  Domains                 Map average 7 domains   Use upload template
                          per industry (approx.   
                          224)                    

  Roles                   Create average 14 role  Role shells with
                          shells per domain       roadmap metadata
                          (approx. 3,136)         

  Priority courses        Populate selected       Recommended 30 priority
                          demo-ready role courses courses

  Modules                 6-12 modules per        At least one complete
                          complete course         course flow must work

  Artifacts               4-8 artifacts +         At least one artifact
                          capstone per complete   path must work
                          course where ready      

  Rubrics                 AI evaluation rubric    Score/feedback must be
                          per priority artifact   stable for demo
  -----------------------------------------------------------------------

## 12.1 Use Inheritance, Not Regeneration

The hierarchy must be system-controlled:

Ecosystem Standard -\> Course Standard -\> Module Standard -\> Task
Standard -\> Assessment Standard

Every lower layer must inherit approved definitions from the layer
above. AI must retrieve exact values rather than recreate them from
memory or prompt wording.

## 12.2 Permanent IDs Everywhere

  -----------------------------------------------------------------------
  **Object**                          **ID Example**
  ----------------------------------- -----------------------------------
  Course                              CRS-CIV-JSE-01

  Module                              MOD-CIV-JSE-01-03

  Capability                          CAP-CIV-004

  Task                                TSK-CIV-JSE-03-02

  Evidence                            EVD-CIV-JSE-03-02

  Rubric                              RUB-CIV-004-L2
  -----------------------------------------------------------------------

Every task, artifact, rubric, assessment and AI evaluation must
reference these IDs. Names may vary slightly in display text only where
approved; IDs remain stable and machine-checkable. When a capability
name differs but the ID is identical, the system replaces it with the
canonical name and logs the variance.

## 12.3 Cross-Module and Cross-Course Consistency Checks

  -----------------------------------------------------------------------
  **Check**                           **Required Question**
  ----------------------------------- -----------------------------------
  Definition consistency              Is the capability used with the
                                      same canonical meaning?

  Level progression                   Is performance becoming more
                                      independent, complex and
                                      judgement-based?

  Evidence progression                Is the evidence becoming stronger,
                                      not merely longer?

  6E integrity                        Does each activity satisfy the
                                      fixed purpose of its E stage?

  Duplication                         Is a task repeated without
                                      increased complexity or changed
                                      context?

  Transferability                     Is a shared capability assessed
                                      consistently across courses?

  Rubric alignment                    Does the rubric evaluate the same
                                      behaviours and evidence stated in
                                      the Capability Master?
  -----------------------------------------------------------------------

## 12.4 Maintain Anchor Examples

For every 6E stage and every level, store one approved example, one
borderline example and one rejected example. These anchors reduce
semantic drift during generation and validation.

  -----------------------------------------------------------------------
  **L3 Independent Performance**      **Example**
  ----------------------------------- -----------------------------------
  Approved                            Learner independently produces a
                                      BOQ from a drawing and explains two
                                      quantity variances.

  Borderline                          Learner fills a BOQ using a
                                      partially completed template.

  Rejected                            Learner identifies BOQ terminology
                                      in a quiz.
  -----------------------------------------------------------------------

## 12.5 Version Every Governance Standard

Each generated module must record the governance versions used. This
enables controlled updates, audits and selective regeneration.

  -----------------------------------------------------------------------
  **Governance Item**                 **Example Version**
  ----------------------------------- -----------------------------------
  Capability Dictionary               v1.2

  6E Framework                        v1.0

  Level Framework                     v1.1

  Course Architecture                 v2.0

  Rubric Standard                     v1.3
  -----------------------------------------------------------------------

## 12.6 Selective Regeneration Implementation Contract

A governance-version change must not mutate already published content or
historical learner outcomes. Affected content is marked
regeneration_required. Regeneration creates a new content version,
repeats deterministic and semantic validation, requires human approval,
and preserves the prior published version and all learner records.

  -----------------------------------------------------------------------
  **Contract Area**                   **Mandatory Rule**
  ----------------------------------- -----------------------------------
  Trigger                             An approved change to a capability,
                                      6E, proficiency-level,
                                      course-architecture, rubric,
                                      evidence or mapping version
                                      initiates impact analysis. Draft or
                                      unapproved changes do not
                                      regenerate published content.

  Affected content identification     Use permanent IDs and stored
                                      governance versions to identify
                                      only the courses, modules, tasks,
                                      evidence items, rubrics and
                                      assessments that reference the
                                      changed standard.

  Historical preservation             Do not mutate prior published
                                      content, learner attempts,
                                      submissions, evaluations, XP
                                      events, readiness snapshots,
                                      marketplace decisions or audit
                                      records.

  Required state                      Mark each affected content record
                                      regeneration_required with trigger
                                      item, trigger version, reason,
                                      detected_at and affected prior
                                      content version.

  New content version                 Regeneration creates a new draft
                                      content version linked through
                                      supersedes_content_version. The
                                      prior published version remains
                                      available and historically
                                      resolvable.

  Revalidation and approval           Run deterministic validation and
                                      separate semantic AI validation
                                      again. Resolve all rejected/flagged
                                      results and obtain authorised human
                                      governance approval before
                                      publication.

  Publication and learner impact      Publish only as a new approved
                                      version. Do not retroactively
                                      change historical learner outcomes.
                                      Any learner migration to the new
                                      content version must be an
                                      explicit, separately audited
                                      decision.
  -----------------------------------------------------------------------

## 13. Required Engineering States

  -----------------------------------------------------------------------
  **State Group**                     **Allowed Values**
  ----------------------------------- -----------------------------------
  Artifact states                     draft, submitted, under_review,
                                      resubmit_required, manual_review,
                                      accepted, rejected

  Module states                       not_started, in_progress,
                                      learning_complete,
                                      artifact_submitted, under_review,
                                      resubmit_required, accepted,
                                      mastered

  Marketplace states                  not_ready, learning_in_progress,
                                      internship_ready, job_ready,
                                      blocked
  -----------------------------------------------------------------------

## 13.2 Integrity, Idempotency and Version Rules

> • Unique XP constraint: unique_event_reference = learner_id +
> source_type + source_id.
>
> • A submission attempt and evaluation result are append-only audit
> records; the latest accepted attempt is official but prior attempts
> remain available.
>
> • Rubric and configuration versions used for a historical
> evaluation/readiness snapshot must remain resolvable.
>
> • No rubric/configuration change may silently recalculate or alter
> prior learner outcomes.
>
> • Every manual override stores prior and new values, actor, reason and
> timestamp.
>
> • Every evaluation record must store submission ID, learner ID,
> artifact ID, rubric ID and version, AI model/version where available,
> criterion scores, overall score, critical-failure flag, confidence
> score, outcome, timestamp, override details and reviewer identity.
>
> • Rubric changes must not silently alter previous learner scores.
> Every rubric change creates a new version.

## 13.3 Governance Integrity, IDs and Version Rules

> • Capability, 6E and proficiency-level definitions are immutable once
> referenced by published content; any update creates a new version.
>
> • All course, module, task, evidence, rubric, assessment and
> AI-evaluation records must retain the permanent IDs and governance
> versions used.
>
> • A generated task cannot be stored or published without a valid
> course ID, module ID, capability ID, canonical capability name, fixed
> 6E stage, target level, allowed support, required evidence, rubric ID,
> governance versions and validation status.
>
> • Missing governance input is a blocking configuration error. The
> system must not infer a replacement value.
>
> • Every deterministic and semantic validation execution creates a
> separate governance_validation_run record, including model/rule
> versions, structured errors, warnings and trace_id.
>
> • Human governance approval must reference the validation runs
> reviewed. Publication must reference the approval record and exact
> content/governance versions.
>
> • Mapping records are versioned approvals.
> course_module_capability_mapping and task_evidence_rubric_mapping must
> retain status, approver, approval date, effective dates and superseded
> version.
>
> • A governance-version change must never mutate published content,
> evaluation history, learner attempts, XP events, readiness snapshots
> or marketplace decisions. Affected content is marked
> regeneration_required and processed as a new content version.

## 13.4 Governance Validation, Approval, Publication and Regeneration Records

The governance_validation_run, governance_approval,
content_publication_record and governance_regeneration_record entities
are mandatory audit records. They must separately preserve
generation-control results, deterministic validation, semantic AI
validation, human decisions, publication history and
selective-regeneration history. A single validation_status field in
generated_task_record is a current-state summary only and must not
replace these append-only records.

## 13.5 Mandatory Output Fields for Every Generated Task

  -----------------------------------------------------------------------
  **Field**                           **Requirement**
  ----------------------------------- -----------------------------------
  Course ID                           Must match approved course.

  Module ID                           Must match module architecture.

  Capability ID                       Must exist in Capability Master.

  Capability Name                     Must match canonical name exactly.

  6E Stage                            Must be selected from the fixed
                                      dictionary.

  Target Level                        Must fall within approved level
                                      range.

  Learner Action                      Must describe observable
                                      performance.

  Allowed Support                     Must match the level definition.

  Required Evidence                   Must prove the stated capability.

  Rubric ID                           Must link to approved evidence and
                                      level criteria.

  Governance Versions                 Must identify the standards used.

  Validation Status                   Pass, Flag or Reject with reasons.

  Content Version                     Must identify the new immutable
                                      content version and any superseded
                                      content version.

  Regeneration Status                 Must show not_required,
                                      regeneration_required, in_progress,
                                      validated, approved, published or
                                      cancelled with reasons.
  -----------------------------------------------------------------------

## 14.1 Deterministic Processing Order

Submission -\> structured evaluation -\> system
threshold/critical-failure decision -\> artifact state -\> module
mastery check -\> evidence XP event -\> readiness snapshot -\>
marketplace eligibility evaluation. AI output must never directly mutate
XP, readiness or marketplace state.

## 14.2 Governed Content Production Flow

Select course -\> Retrieve approved capabilities -\> Retrieve target
module level -\> Retrieve 6E requirements -\> Generate structured module
-\> Run deterministic validation -\> Run semantic AI validation -\>
Human governance approval -\> Publish

Publishing is fail-closed. A rejected rule or missing governance input
blocks publication. A flagged rule requires authorised human review and
a recorded decision.

  -------------------------------------------------------------------------------------------------
  **Screen**            **User**              **Required Content / CTA**
  --------------------- --------------------- -----------------------------------------------------
  Learner Dashboard     Learner               AI report summary, active role, path card, next
                                              action, XP, artifact status, readiness, marketplace
                                              status, Continue Learning CTA

  3-Track Report / Role Learner               Track cards, role cards, selected/recommended roles,
  Entry                                       role selection/admin assigned indication

  Role Details          Learner               Role overview, industry/domain, required
                                              capabilities, readiness fit, Set as Target Role CTA

  6-Month Roadmap       Learner               Month-wise roadmap, courses, modules, milestones,
                                              artifacts and XP target

  Course View           Learner               Course objective, capability focus, module list,
                                              Start/Resume Course CTA

  Module 6E Player      Learner               Engage, Explore, Explain, Express, Empower and Evolve
                                              with locked/active/completed states, persistent
                                              progress and separate learning-complete/mastered
                                              indicators

  Problem Statement     Learner               Scenario, task, expected output, rubric and artifact
                                              requirement

  Artifact Submission   Learner               Upload/file/link/text/code/spreadsheet/PPT/PDF/DOCX
                                              field, save draft, submit, status

  AI Feedback Result    Learner               Criterion scores, evidence found/missing, overall
                                              score, confidence, critical-failure/manual-review
                                              status, feedback, resubmission guidance and
                                              system-awarded XP

  Admin Upload          Admin                 Taxonomy, role, course, module, problem, rubric and
                                              XP upload forms

  Admin Tracking        Admin                 Learner-role-course progress, submissions, AI status,
                                              XP, readiness and marketplace status

  Manual Review Status  Learner / Admin       Pending reason, assigned review state, prior attempts
                                              and final reviewer decision

  Readiness Breakdown   Learner / Admin       Five weighted components, last calculated date,
                                              current path, missing evidence, configuration
                                              warnings and actions to improve

  Marketplace           Learner / Admin       Score band, mandatory-condition checklist, consent
  Eligibility Detail                          status, eligibility/blocked status and reason

  Capability Master     Admin / Governance    Canonical capability ID/name, definition, observable
                                              behaviours, evidence, skills, approved level range,
                                              prohibited interpretation, version and approval
                                              status.

  6E and Level Master   Admin / Governance    Fixed 6E purpose/prohibited meaning/minimum event and
                                              L1-L5 meanings, performance signals and allowed
                                              support.

  Capability-6E-Level   Admin / Content       Course/module capability, stage, task, evidence,
  Matrix                                      target level, allowed support, validation and
                                              approval state.

  Semantic Validation   Content / Governance  Capability, 6E, level, evidence and progression
  Result                                      errors; no silent rewrite; approve, reject or return
                                              for correction.

  Governance Version    Admin / QA            Capability, 6E, level, course architecture and rubric
  History                                     versions with approval and effective dates.

  Governance Approval   Governance Owner      Deterministic result, semantic result, validation
                                              reasons, reviewer decision and Publish CTA only after
                                              pass/approved flag resolution.
  -------------------------------------------------------------------------------------------------

# 16. Non-Functional Requirements

  -----------------------------------------------------------------------
  **Area**                            **Requirement**
  ----------------------------------- -----------------------------------
  Performance                         Learner dashboard and module
                                      screens should load within
                                      acceptable demo/pilot performance;
                                      path generation should be fast
                                      enough for live demo

  Reliability                         Report ingest, artifact upload,
                                      evaluation trigger and XP events
                                      must have retry/error states

  Security                            RBAC for
                                      learner/admin/mentor/reviewer
                                      actions; file/link handling must be
                                      secure

  Auditability                        Audit role assignment, content
                                      upload, artifact submission, AI
                                      evaluation, XP event, readiness
                                      calculation and admin override

  Explainability                      Learner/admin should understand why
                                      a path/course was recommended

  Data integrity                      No duplicate profiles for duplicate
                                      report ingest; no duplicate XP for
                                      same event reference

  Scalability                         Data model must support full
                                      taxonomy and phased content
                                      expansion

  Accessibility                       Mobile-friendly, clear CTAs, state
                                      badges and low-cognitive-load UI

  AI fallback                         Rule-based path generation and
                                      rubric/manual review fallback must
                                      be available if AI is not ready

  Determinism                         Backend recalculates and applies
                                      artifact outcome, XP, readiness and
                                      marketplace rules; AI is advisory
                                      except for structured evidence
                                      evaluation.

  Idempotency                         XP awards, evaluation triggers,
                                      readiness recalculation and
                                      retryable submissions must be safe
                                      against duplicate processing.

  Versioning                          Rubrics, XP configuration,
                                      readiness formula and consent use
                                      explicit versions; historical
                                      outcomes retain their original
                                      versions.

  Observability                       Every product-rule decision is
                                      traceable through logs and stored
                                      records using trace_id and
                                      entity/event references.

  Privacy and consent                 Marketplace visibility requires
                                      active versioned consent and must
                                      stop after consent withdrawal or
                                      account deactivation.

  Governance immutability             Capability definitions, 6E
                                      meanings, proficiency levels,
                                      progression rules and evidence
                                      standards are versioned immutable
                                      master data once used.

  Semantic consistency                The same capability ID must retain
                                      the same canonical meaning within
                                      modules, between modules and across
                                      courses.

  Fail-closed generation              Missing, invalid or unapproved
                                      governance input stops
                                      generation/publishing rather than
                                      allowing AI improvisation.

  Validation separation               Generation AI, semantic-validation
                                      AI and deterministic system
                                      validation are separate controls;
                                      semantic validation must not
                                      silently rewrite content.

  Version traceability                Every generated task, module,
                                      artifact, rubric and evaluation
                                      stores the governance versions used
                                      and supports selective
                                      regeneration.

  Selective regeneration safety       Governance updates must use
                                      impact-based regeneration,
                                      immutable historical versions,
                                      explicit regeneration_required
                                      state, full revalidation and
                                      reapproval. Published content and
                                      historical learner outcomes must
                                      never be mutated in place.
  -----------------------------------------------------------------------

## 18.4 Frozen Engineering Acceptance Criteria

  -----------------------------------------------------------------------
  **\#**                              **Acceptance Criterion**
  ----------------------------------- -----------------------------------
  1                                   A learner cannot skip 6E stages.

  2                                   A module is not mastered before
                                      artifact acceptance.

  3                                   AI returns structured
                                      criterion-level results.

  4                                   A critical failure overrides the
                                      numeric score.

  5                                   Failed or uncertain AI evaluations
                                      follow the approved resubmission
                                      workflow and move to manual review
                                      when any frozen manual-review
                                      condition is met, including low
                                      confidence, unreadable/ambiguous
                                      evidence, safety/compliance issues,
                                      AI retry failure, learner dispute
                                      or two failed resubmissions.

  6                                   XP is not duplicated.

  7                                   AI cannot directly award XP.

  8                                   Readiness is calculated only
                                      through the approved formula and
                                      evidence-bearing XP.

  9                                   Marketplace status reflects both
                                      score and mandatory eligibility
                                      conditions.

  10                                  Every product-rule decision is
                                      traceable through logs and stored
                                      records.

  11                                  AI cannot rename, redefine, merge,
                                      split or infer a capability, 6E
                                      stage or proficiency level.

  12                                  An unknown capability ID, unmapped
                                      course capability or out-of-range
                                      level is rejected.

  13                                  Empower without a meaningful
                                      performance task and artifact is
                                      rejected.

  14                                  Evolve without reflection,
                                      improvement, transfer, adaptation
                                      or higher-complexity application is
                                      rejected.

  15                                  Missing governance input stops
                                      generation and returns MISSING
                                      GOVERNANCE INPUT.

  16                                  Every generated task stores all
                                      mandatory permanent IDs, governance
                                      versions and validation status.

  17                                  Semantic validation reports errors
                                      without silently rewriting content.

  18                                  Human governance approval is
                                      recorded before publish.

  19                                  A governance-version change marks
                                      only affected content as
                                      regeneration_required and does not
                                      mutate published content or
                                      historical learner outcomes.

  20                                  Regenerated content creates a new
                                      version, reruns deterministic and
                                      semantic validation, requires human
                                      governance approval before
                                      publication and retains the prior
                                      version for audit.
  -----------------------------------------------------------------------

Interpretation and formal-decision note: the Frozen Acceptance Criterion
states that failed AI evaluations move to manual review, while the
detailed frozen workflow permits resubmission and requires manual review
when a listed frozen review condition occurs or after two failed
resubmissions. Decision ID AI-REVIEW-FLOW-001 formally records the
proposed resolution: initial failed evaluations result in
resubmit_required; manual review becomes mandatory when any frozen
manual-review condition occurs or after two failed resubmissions. This
decision remains pending formal Product and Governance approval.

## 18.5 Additional Mandatory QA Scenarios

> • Stage completion persists after refresh/resume and is not triggered
> by page view alone.
>
> • learning_complete, artifact_submitted, under_review, accepted and
> mastered are distinguishable in API responses and UI.
>
> • Scores 0-49, 50-69, 70-84 and 85-100 map to the approved outcomes
> and mastery impact.
>
> • Confidence below 0.70, unreadable artifact, ambiguous
> interpretation, safety/compliance detection, AI retry failure and
> learner dispute route to manual review.
>
> • After two failed resubmissions, the artifact is routed to manual
> review.
>
> • Readiness milestones, login, profile, streak, legacy and promotional
> XP do not increase readiness.
>
> • Missing expected XP produces XP component 0 plus a configuration
> error.
>
> • A qualifying readiness score with missing consent/profile/accepted
> artifact/target role/account/critical-failure clearance returns
> blocked with a reason.
>
> • Rubric version changes do not alter prior evaluation records or
> readiness snapshots.
>
> • Manual override records reviewer/admin identity, timestamp, reason,
> prior value and new value.

## 18.6 AI Capability, 6E and Level Governance QA Scenarios

  -----------------------------------------------------------------------
  **Scenario**                        **Expected Result**
  ----------------------------------- -----------------------------------
  Capability ID is missing from       Reject generation/publish; return
  Capability Master.                  governance error.

  Capability name differs while ID is Replace with canonical name and log
  valid.                              variance.

  Target level is outside approved    Reject.
  range.                              

  L3 task includes full step-by-step  Flag for governance review.
  guidance.                           

  L4 task has no judgement, diagnosis Flag for governance review.
  or decision.                        

  Empower contains no performance     Reject.
  artifact.                           

  Evolve is only a conclusion/survey. Reject.

  Capability is repeated in another   Flag or reject based on duplication
  module without increased            policy.
  independence, complexity or         
  context.                            

  Shared capability uses different    Reject and restore canonical
  canonical meanings across courses.  definition.

  Rubric does not assess Capability   Reject.
  Master behaviours/evidence.         

  Required governance value is        Return MISSING GOVERNANCE INPUT; do
  unavailable.                        not improvise.

  All validation passes.              Route to authorised human
                                      governance approval, then publish.

  An approved governance-version      Identify affected records by
  change affects published            permanent IDs and stored versions;
  tasks/modules.                      mark them regeneration_required;
                                      preserve published versions and all
                                      learner records.

  Regenerated content completes       Publish as a new content version
  validation and approval.            only after deterministic
                                      validation, semantic validation and
                                      authorised human approval; retain
                                      the prior version and do not alter
                                      historical learner outcomes.
  -----------------------------------------------------------------------

## 19.1 Formal 6E Artifact-Stage Decision Record

  -----------------------------------------------------------------------
  **Decision field**                  **Required value**
  ----------------------------------- -----------------------------------
  Decision ID                         6E-ARTIFACT-TRIGGER-001

  Primary mandatory artifact stage    Empower

  Evolve purpose                      Reflection, revision, improvement,
                                      transfer, adaptation or
                                      higher-complexity application

  Approved by                         Product Lead and L&D/Governance
                                      Owner

  Approval date                       Pending

  Effective governance version        Pending

  Supersedes                          Conflicting 6E artifact-stage
                                      descriptions in Frozen Rules v1.0
  -----------------------------------------------------------------------

Interim engineering constraint: Until this record is signed and an
effective governance version is assigned, the system must not hard-code
the final artifact submission stage. Artifact submission and artifact
status must remain independent from 6E stage completion.

## 19.2 Formal Failed-Evaluation and Manual-Review Decision Record

  -----------------------------------------------------------------------
  **Decision field**                  **Required value**
  ----------------------------------- -----------------------------------
  Decision ID                         AI-REVIEW-FLOW-001

  Initial failed evaluation outcome   resubmit_required

  Manual review becomes mandatory     When any frozen manual-review
                                      condition occurs or after two
                                      failed resubmissions

  Frozen manual-review conditions     confidence_score \< 0.70;
                                      unreadable artifact; ambiguous
                                      interpretation; safety/compliance
                                      issue; AI retries fail; learner
                                      dispute; or two failed
                                      resubmissions

  Approved by                         Product Lead, AI Lead, QA Lead and
                                      Learning Technology & Engineering
                                      Governance Owner

  Approval date                       Pending

  Effective rule/configuration        Pending
  version                             

  Supersedes / resolves               Ambiguity between the Frozen
                                      Engineering Acceptance Criterion
                                      and the detailed
                                      resubmission/manual-review workflow
  -----------------------------------------------------------------------

Interim engineering constraint: Until Decision ID AI-REVIEW-FLOW-001 is
approved and assigned an effective rule/configuration version, use the
detailed frozen workflow as provisional version-controlled behaviour:
initial failed evaluations move to resubmit_required unless a frozen
manual-review condition already applies; manual review is mandatory when
any frozen manual-review condition occurs or after two failed
resubmissions. Do not change the score thresholds, review conditions or
maximum resubmission count without written approval.

## 19.3 Final Handover Statement

Frozen Handover Statement\
These rules are frozen for the LTE MVP. Engineering must implement them
as deterministic system behaviour. AI may evaluate evidence and generate
feedback, but the backend remains the final authority for artifact
status, XP, readiness and marketplace eligibility. Any change to
thresholds, states, scoring logic or progression rules requires written
product approval and version control.

## 19.4 Final AI Governance Statement for Engineering

AI Governance Handover Statement \| Capability, Vidya Setu 6E and
proficiency-level definitions are immutable master data. All courses,
modules, tasks, artifacts, rubrics and AI evaluations must reference
approved IDs and canonical definitions. AI may contextualise these
elements but may not rename, redefine, merge, split or infer new
meanings without governance approval. Where required governance data is
missing, the system must stop generation and return a governance error
rather than improvise.

Document owner: Rareminds - Learning Technology and Engineering
Governance

# Appendix A. Source Mapping Summary

  -----------------------------------------------------------------------
  **Source**                          **How It Was Mapped**
  ----------------------------------- -----------------------------------
  LTE MVP Frozen Product Rules for    Normative approved engineering
  Engineering Handover v1.0           source for deterministic
                                      module/mastery states, 6E
                                      progression, AI thresholds/manual
                                      review, XP separation, readiness
                                      formula, marketplace conditions,
                                      audit/version control and change
                                      control

  LTE Product Specification Final v2  Primary engineering source for
                                      role-readiness logic, 6E hard
                                      rules, progression rules, data
                                      model, API set, state machine,
                                      dashboard improvements, fallback
                                      system, artifact-centric system and
                                      team ownership

  LTE MVP Build Document              Primary execution source for 3-week
                                      objective, scope, flow,
                                      out-of-scope items, content
                                      architecture, admin workflow,
                                      dashboard, AI/XP, marketplace
                                      readiness, acceptance criteria and
                                      risks

  LTE 3-Week MVP Briefing Deck        Used for north star, weekly
                                      outcomes, demo gates and acceptance
                                      checklist

  Rareminds Skill Ecosystem BRD       Used to preserve mode separation
  Revisited                           between LTE, Resource Studio and
                                      School Showcase/Beyond Marks, and
                                      to keep school data separate from
                                      recruiter/marketplace flows

  Resource Studio PRD Reference       Used as PRD format/style reference
                                      and to preserve naming conventions
                                      and evidence/permission awareness

  LTE_JSON schema context             Used to align entity/table names to
                                      existing LTE structures where
                                      available

  Prior SRD and PM gap context        Used to retain assessment-to-LTE,
                                      6E, artifact, AI evaluation, XP,
                                      readiness and marketplace flow
                                      mapping

  AI Governance Standard for          Normative governance source for
  Capability, 6E and                  immutable capability definitions,
  Proficiency-Level Consistency       fixed Vidya Setu 6E meanings,
                                      proficiency levels, learning
                                      hierarchy, permanent IDs,
                                      capability-6E-level matrices, AI
                                      generation/semantic/deterministic
                                      validation, cross-course
                                      consistency, anchor examples,
                                      governance versioning and
                                      fail-closed publication.
  -----------------------------------------------------------------------

# Appendix B. Frozen Product Rules Compliance Matrix

  ---------------------------------------------------------------------------------------------------------------------------------
  **Frozen Rule Area**              **Original PRD    **Correction Applied**                                         **Updated
                                    Status**                                                                         Location**
  --------------------------------- ----------------- -------------------------------------------------------------- --------------
  1\. Module completion             Partial           Separate learning_complete, artifact_submitted, accepted and   Sections 6, 8,
                                                      mastered states; formulas and course progress distinction      13, 18
                                                      added                                                          

  2\. 6E progression                Partial           Persistence, no-page-view completion and authorised override   Sections 6, 8,
                                                      retained; authoritative fixed 6E meanings added; Empower is    14, 17, 18,
                                                      the recommended primary mandatory performance-artifact stage   Appendix C
                                                      and Evolve is fixed as reflection, improvement, transfer,      
                                                      adaptation or higher-complexity application, pending formal    
                                                      approval under Decision ID 6E-ARTIFACT-TRIGGER-001.            

  3\. AI evaluation                 Major gaps        Inputs/outputs, score meaning, thresholds, critical failure,   Sections 6, 9,
                                                      confidence, resubmission, manual review and official attempt   14, 18
                                                      added; all residual XP-recommendation wording removed from the 
                                                      flow                                                           

  4\. XP rule                       Incorrect         Evidence vs engagement categories corrected; full event lists, Sections 9,
                                    categorisation    readiness exclusion, xp_category and dedupe added              13, 14

  5\. Readiness formula             Missing           Exact weights, component rules, missing-score handling, full   Sections 6,
                                                      approved trigger list and auditable snapshots added; narrow    10, 13, 14
                                                      legacy trigger wording removed                                 

  6\. Marketplace bands             Partial           Exact bands, access, mandatory conditions, blocked state and   Sections 6,
                                                      consent added consistently across success criteria and the     10, 13, 14
                                                      end-to-end flow                                                

  7\. AI vs system responsibility   Partial           Complete responsibility matrix and backend authority added     Sections 4,
                                                                                                                     11, 14

  8\. Engineering states            Missing/partial   Exact artifact, module and marketplace enumerations added      Sections 8 and
                                                                                                                     13

  9\. Audit/version control         Partial           Required evaluation fields, rubric versioning, immutable       Sections 6,
                                                      history and override audit added                               11, 13, 16

  10\. Acceptance criteria          Partial           All frozen criteria added and the failed-evaluation criterion  Section 18
                                                      reconciled with the detailed resubmission/manual-review rules  

  11\. Sign-off/change control      Incomplete        Full sign-off roles and final frozen handover statement added  Section 19

  12\. Capability/6E/level          New mandatory     Capability Master, fixed learning hierarchy, authoritative 6E  Sections 6, 8,
  governance                        governance source definitions, L1-L5 levels, control matrix, inheritance, IDs,   9, 11-18,
                                                      three-layer AI control, consistency checks, anchor examples,   Appendix D
                                                      versioning, master tables, governed flow and generated-task    
                                                      output contract integrated.                                    

  13\. 6E artifact-stage formal     Previously        Recommended primary mandatory performance artifact stage is    Sections 6, 8,
  decision                          unresolved source Empower; Evolve remains                                        14, 17, 18,
                                    conflict;         reflection/improvement/transfer/adaptation/higher-complexity   Appendix C
                                    recommended       application. Formal Product and Governance approval, date and  
                                    interpretation    effective governance version are required before engineering   
                                    pending approval  hard-codes the trigger.                                        

  14\.                              Previously        Decision ID AI-REVIEW-FLOW-001 added. Initial failed           Sections
  Failed-evaluation/manual-review   reconciled by     evaluations result in resubmit_required; manual review becomes 9.2.3, 17.4,
  formal decision                   interpretation;   mandatory when any frozen manual-review condition occurs or    18.4 and 19.2
                                    formal approval   after two failed resubmissions. Approval date and effective    
                                    pending           rule/configuration version remain pending.                     
  ---------------------------------------------------------------------------------------------------------------------------------

# Appendix C. 6E Stage Definition Interpretation and Formal Decision Status

The AI Governance Standard for Capability, 6E and Proficiency-Level
Consistency defines the authoritative purpose and prohibited
interpretation of every Vidya Setu 6E stage. It supports Empower as
independent application through a meaningful performance task and
artifact, and Evolve as reflection, revision, improvement, transfer,
adaptation or higher-complexity application. Because the approved Frozen
Product Rules v1.0 contains conflicting final-artifact-stage
descriptions, assigning the primary mandatory artifact to Empower
remains a recommended interpretation pending the formal approval record
in Section 19.1.

  -------------------------------------------------------------------------------------------------------
  **Stage**                         **Authoritative Meaning**         **Artifact / Completion
                                                                      Governance**
  --------------------------------- --------------------------------- -----------------------------------
  Engage                            Realistic problem or challenge    Store problem-context
                                    creates relevance and curiosity.  acknowledgement; not a generic
                                                                      welcome.

  Explore                           Investigation, observation,       Store
                                    comparison, attempt, question or  interaction/observation/response;
                                    discovery.                        not a theory lecture.

  Explain                           Concepts, principles, methods,    Store concept
                                    models and worked examples after  clarification/knowledge check.
                                    exploration.                      

  Express                           Communication of understanding,   Store structured tangible
                                    reasoning, interpretation or      expression; not recall-only MCQ.
                                    design.                           

  Empower                           Independent application through a Recommended pending Decision ID
                                    meaningful performance task.      6E-ARTIFACT-TRIGGER-001: submit the
                                                                      primary mandatory performance
                                                                      artifact here. Do not hard-code
                                                                      until approved.

  Evolve                            Reflection, improvement,          Store reflection/revision/transfer
                                    transfer, adaptation or           evidence; revised/capstone transfer
                                    higher-complexity application.    artifact may be separate but cannot
                                                                      replace Empower artifact.

  Recommended interpretation        Recommended interpretation        Recommended interpretation pending
  pending formal approval:          pending formal approval:          formal approval:
  final_artifact_submission_stage = final_artifact_submission_stage = final_artifact_submission_stage =
  Empower for the primary mandatory Empower for the primary mandatory Empower for the primary mandatory
  module performance artifact.      module performance artifact.      module performance artifact. Evolve
  Evolve remains mandatory and must Evolve remains mandatory and must remains mandatory and must evidence
  evidence reflection, improvement, evidence reflection, improvement, reflection, improvement, transfer,
  transfer, adaptation or           transfer, adaptation or           adaptation or higher-complexity
  higher-complexity application. If higher-complexity application. If application. If an Evolve capstone
  an Evolve capstone or revised     an Evolve capstone or revised     or revised deliverable is
  deliverable is configured, it is  deliverable is configured, it is  configured, it is an
  an additional/revised transfer    an additional/revised transfer    additional/revised transfer
  artifact with its own ID and      artifact with its own ID and      artifact with its own ID and
  workflow record, not a            workflow record, not a            workflow record, not a replacement
  replacement for the recommended   replacement for the recommended   for the recommended Empower
  Empower artifact. Engineering     Empower artifact. Engineering     artifact. Engineering must wait for
  must wait for Decision ID         must wait for Decision ID         Decision ID 6E-ARTIFACT-TRIGGER-001
  6E-ARTIFACT-TRIGGER-001 approval  6E-ARTIFACT-TRIGGER-001 approval  approval before hard-coding this
  before hard-coding this mapping.  before hard-coding this mapping.  mapping.
  -------------------------------------------------------------------------------------------------------

# Appendix D. AI Governance Source Traceability Matrix

This matrix confirms that every substantive section of the AI Governance
Standard for Capability, 6E and Proficiency-Level Consistency has been
integrated into a specific PRD location.

  -----------------------------------------------------------------------
  **Governance Source     **Integrated PRD        **Status**
  Section**               Location**              
  ----------------------- ----------------------- -----------------------
  1\. Core Governance     Frozen precedence;      Integrated
  Principle               Executive Summary;      
                          FR19; Section 9.4;      
                          Sections 19.2-19.3      

  2\. Freeze Capability   Sections 8.4, 11, 13    Integrated
  as Formal Data Object                           

  3\. Fix the Learning    Sections 8.5 and 12     Integrated
  Hierarchy                                       

  4\. Freeze Vidya Setu   Sections 6, 8.2-8.3,    Definitions integrated;
  6E Definitions          18; Appendix C          artifact-stage
                                                  recommendation pending
                                                  formal decision-record
                                                  approval

  5\. Define Levels       Sections 8.6, 11, 13,   Integrated
  Through Observable      18                      
  Performance                                     

  6\. Mandatory           Sections 8.7, 11, 17,   Integrated
  Capability-6E-Level     18                      
  Control Matrix                                  

  7\. Use Inheritance,    FR21; Section 12.1      Integrated
  Not Regeneration                                

  8\. Use Permanent IDs   FR21; Sections 12.2,    Integrated
  Everywhere              13, 14                  

  9\. Three Layers of AI  FR20; Sections 9.4 and  Integrated
  Control                 14                      

  10\. Cross-Module and   FR22; Sections 12.3 and Integrated
  Cross-Course            18.6                    
  Consistency Checks                              

  11\. Maintain Anchor    Sections 11, 12.4, 13   Integrated
  Examples                                        

  12\. Version Every      Sections 12.5-12.6,     Integrated
  Governance Standard     13.3-13.5, 16           

  13\. Required           Sections 11 and 13      Integrated
  Engineering Master                              
  Tables                                          

  14\. Recommended System Section 14.2            Integrated
  Flow                                            

  15\. Mandatory Output   Section 13.5; API/UI/QA Integrated
  Fields for Every        requirements            
  Generated Task                                  

  16\. Final Governance   Section 19.3            Integrated
  Statement for                                   
  Engineering                                     
  -----------------------------------------------------------------------
