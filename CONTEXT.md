# Tsugi

Tsugi is a closed school community app for students at one high school. It exists to share school-life information such as timetable changes, tasks, and notes, and may later support requests, test-result collection, personalised reports, and discussion threads.
Its initial core is helping students understand their current timetable and tasks through active shared information, change proposals, direct changes, approvals, and rejections.

## Runtime Assumption

Tsugi is intended to be usable as a Progressive Web App (PWA), especially on mobile devices. UI, authentication, caching, and deployment decisions should preserve the option for installable, app-like usage and future offline or notification support.

## Language

**School Community**:
A closed usage boundary for students who belong to one high school. Timetables, assignments, surveys, test results, reports, and threads are shared or collected inside this school community.
_Avoid_: Multi-school platform, social network, bulletin board app

**Student**:
A person who attends the high school and can participate in the school community. Students are the only members of Tsugi.
_Avoid_: User, member, teacher, administrator

**Student Account**:
The account a student uses to participate in Tsugi. A student account is created only after the student proves access to an eligible school email and completes required profile details such as display name and student affiliation.
_Avoid_: User account, anonymous account, shared account, domain-only account, Google account, verified email alone

**School Email**:
The school-issued email address used to determine whether a student can create a student account. Parts of the school email may identify cohort-like or stable student information, but Tsugi does not use them to infer affiliation or expose them as student identity.
_Avoid_: Personal email, affiliation source, public identifier

**School Email Number**:
The student-entered numeric part that Tsugi uses to construct a full school email. The school email number is not treated as a public identifier or as proof of current student affiliation by itself.
_Avoid_: Student ID, login ID, affiliation code, public identifier

**Verification Code**:
A short one-time code sent to a school email so a student can prove access to that school email during sign-up or sign-in. Verification codes are stored only as hashes, older unused codes for the same school email are invalidated when a new code is issued, and repeated requests are rate-limited.
_Avoid_: Magic link, password, invitation code, permanent credential

**Display Name**:
The name shown for a student in ordinary Tsugi activity, usually a nickname rather than the student's real name.
_Avoid_: Real name, legal name, account name

**Real Name**:
The student's actual name, used only where a named response needs to identify who answered.
_Avoid_: Display name, nickname

**Named Attribution**:
Showing a student's display name as the source of ordinary Tsugi activity. Direct changes use named attribution, while change proposals, approvals, and rejections do not show the individual students behind them.
_Avoid_: Real-name attribution, anonymous identity, reputation

**Student Affiliation**:
A student's self-selected grade, class, and track inside the school community. Student affiliation determines which target scopes currently apply to the student and can be changed by the student.
_Avoid_: Profile, role, permission

**Affiliation Renewal**:
The student's self-selection of their grade, class, and track for a new school year. Tsugi does not automatically promote affiliations across school years; before renewal, prior-year information may be reference-only rather than part of the current daily plan.
_Avoid_: Auto-promotion, roster sync

**Grade**:
A student's school grade within the high school, such as first year, second year, or third year.
_Avoid_: School year

**Class**:
A student grouping within a grade and school year, such as 2-3. Classes are not the same across school years even if they share the same number.
_Avoid_: Homeroom, classroom

**Shared Information**:
School-life information that students share inside the school community, such as timetable changes, tasks, and notes. Shared information is not official school information.
_Avoid_: Official information, school announcement, post

**Active Shared Information**:
Shared information whose latest applied change makes it currently reflected in student-facing plans or views, such as a daily plan or multi-day plan. Active shared information may come from an accepted change proposal or a direct change, and stops being active when a later shared information change removes it.
_Avoid_: Master, official information, approved item, canonical item

**Shared Information Change**:
An accepted change proposal or direct change that has been applied to shared information. Shared information changes form the history from which active shared information can be understood.
_Avoid_: Patch, commit, revision, audit log

**Change Proposal**:
A proposed addition, update, or removal of shared information. A change proposal is pending until enough approvals accept it or enough rejections reject it.
_Avoid_: Candidate, edit, revision, correction

**Base Change**:
The shared information change that a change proposal uses as the starting point for an update or removal. If active shared information changes after a proposal's base change, the proposal becomes stale before it can be accepted.
_Avoid_: Parent revision, source version, previous edit

**Stale Change Proposal**:
A change proposal that can no longer be accepted because the active shared information it was based on has already changed. A stale change proposal is different from a rejected change proposal.
_Avoid_: Rejected proposal, expired proposal, superseded proposal

**Direct Change**:
A direct addition, update, or removal of shared information that becomes active without waiting for approvals. A direct change still follows creator scope and has a target scope like a change proposal, and is common when a student relays school-life information to the target scope.
_Avoid_: Forced edit, admin edit, bypass

**Approval**:
A target-scope student's signal that a change proposal should be accepted and reflected as active shared information. An approval is about accepting a proposed change, not liking the information or completing a task, and the student who made the proposal does not count toward the required approvals.
_Avoid_: Like, confirmation, task completion, official approval

**Rejection**:
A target-scope student's signal that a change proposal should not be accepted. A rejection belongs to the change proposal, not to the student who made the proposal.
_Avoid_: Downvote, dislike, moderation action

**Collection**:
A request for students in a target scope to submit structured answers. A collection produces aggregate results and may produce a personalised report for each responding student.
_Avoid_: Form, questionnaire, poll

**Request**:
A collection that asks students in a target scope to submit preferences, availability, choices, or other school-life answers. A request may be anonymous or named, and may or may not use a privacy threshold.
_Avoid_: Survey, poll, questionnaire

**Response Visibility**:
Whether collection responses are shown as named responses or anonymous responses. Response visibility is chosen when the collection is created.
_Avoid_: Privacy setting, anonymity mode

**Response Audience**:
Who can see collection responses after submission, such as only the creator or everyone in the target scope. Response audience is chosen when the collection is created.
_Avoid_: Visibility, permission

**Test Result Collection**:
A collection for students to submit their own test results so the school community can produce aggregate results and personalised reports. A test result collection is not an official gradebook or school-issued score report.
_Avoid_: Gradebook, official score report

**Privacy Threshold**:
The minimum response count or condition required before aggregate results are shown, so individual students cannot be reasonably inferred from the aggregate. A privacy threshold is about reducing re-identification risk, not proving statistical trustworthiness.
_Avoid_: Trust threshold, confidence threshold

**Aggregate Result**:
A summary produced from submitted collection answers for a target scope. Aggregate results must not expose another student's individual answer; a privacy threshold may be required before they are shown.
_Avoid_: Individual result, raw answers

**Personalised Report**:
A report shown to one responding student that compares their own submitted answer with aggregate results. A personalised report must not reveal another student's individual answer.
_Avoid_: Public ranking, individual comparison

**Timetable**:
A student's displayed schedule for a school day, date range, or school year, produced from a standard timetable and later timetable changes. A timetable can differ by grade, class, track, and individual student.
_Avoid_: Calendar, event list

**Daily Plan**:
A student's day-level view centered on the timetable, with the tasks and notes relevant to that school date after applying relevant timetable layers and selected target scopes. The daily plan is the primary way a student checks what they need to attend, complete, or notice for the day.
_Avoid_: Daily timetable, calendar, dashboard, home feed

**Multi-Day Plan**:
A student's view across multiple school dates, made from the selected daily plans and centered on the timetable across those dates. A multi-day plan is the primary way a student checks the shape of several school days without treating the range as a fixed week.
_Avoid_: Weekly plan, calendar, dashboard

**Reference Scope**:
A target scope outside a student's own current target scopes that the student chooses to inspect through a daily plan or multi-day plan. Reference scopes may be useful for track-scoped timetables, tasks, and notes; in a class with only one track, the track scope effectively acts like a class scope. Individual-scoped tasks, notes, threads, and test result collections stay limited to their target scope.
_Avoid_: Reference view, public feed, unrestricted access

**Standard Timetable**:
The baseline timetable information for a class and track in a school year. A standard timetable contains recurring lesson slots and may also contain floating lesson references such as "★". Track-specific standard timetable values override class-common values, and timetable changes may refer back to this baseline with lesson references.
_Avoid_: Default calendar, school-wide timetable

**Timetable Change**:
A date-specific change that modifies the displayed daily lessons derived from the standard timetable for a target scope. A timetable change may use lesson references, which resolve for each recipient's class and track, or directly provide lesson names. Timetable changes can be grade-wide, class-specific, track-specific, student-specific, planned in advance, or sudden.
_Avoid_: Calendar event, announcement, emergency change

**School Year**:
The academic year that owns a standard timetable for each class and track.
_Avoid_: Grade, term, semester

**Change Date**:
The school date on which a timetable change applies. A change date may set daily lesson names for that school date using lesson references or direct lesson names.
_Avoid_: Effective period, version

**Timetable Layer**:
A scope-specific source of timetable changes, ordered from broader to narrower scope: standard timetable, grade, class, track, student, and optionally group. Narrower timetable layers override broader layers for the displayed timetable, while broader-layer entries remain inspectable.
_Avoid_: Calendar layer, priority, category

**Track**:
A curriculum grouping under a class that can split the standard timetable. Track names may appear across multiple classes, but Tsugi currently treats track as subordinate to class for target scopes. In a class with only one track, the track scope effectively acts like a class scope.
_Avoid_: Course, subject, class

**Lesson Slot**:
A recurring position in the standard timetable identified by weekday and period number. A lesson slot may have a lesson name, with track-specific values overriding class-common values; a period reference points to a lesson slot and resolves to the lesson name assigned to that slot.
_Avoid_: Class period, clock time

**Daily Lesson**:
The class activity displayed for one school date and period number, usually with a lesson name such as a subject or homeroom activity. A daily lesson is what students see after applying the standard timetable and timetable changes to a daily plan or other timetable view, and may have no lesson name when the period is empty or unset.
_Avoid_: Lesson, subject, period, course

**Lesson Name**:
The displayed name assigned to a daily lesson or lesson slot, such as Mathematics, English, or homeroom. A task may be related to a lesson name without being related to one specific daily lesson on a school date.
_Avoid_: Subject, course

**Lesson Reference**:
A shorthand reference defined by the standard timetable that resolves to a lesson name for a class or track. A lesson reference may be a period reference or a floating lesson reference.
_Avoid_: Lesson slot, subject name, lesson name

**Period Reference**:
A lesson reference to a lesson slot in the standard timetable, such as "Monday period 1". Period references are used when describing timetable changes and resolve to the lesson name assigned to the referenced lesson slot.
_Avoid_: Lesson slot, subject name, clock time

**Floating Lesson Reference**:
A lesson reference used in timetable changes that is not bound to a weekday and period number, such as "★". A floating lesson reference resolves to a lesson name for a class or track, with track-specific values overriding class-common values, but only when a timetable change uses it.
_Avoid_: Lesson slot, period reference, subject name

**Task**:
A school-life obligation shared inside the school community with a due date and target scope. A task may be homework, preparation, a form to submit, something to bring, or another action students need to complete. A task may optionally be related to a daily lesson, a lesson name, or both. A task can have an individual student as its target scope without becoming a separate personal-task concept.
_Avoid_: Assignment, homework, todo

**Note**:
Shared information that records a school-life notice or reminder without being a task or timetable change. A note has a target scope and may have no related context or one related context: a school date, a daily lesson, or a task.
_Avoid_: Announcement, comment, memo

**Task Completion**:
A student's personal completion state for a task. Task completion belongs to the student, not to the shared task itself.
_Avoid_: Task status, confirmation, submission

**Target Scope**:
The set of students a timetable change, task, request, test-result collection, report, or thread applies to. A target scope may be grade, class, track, student, or group.
_Avoid_: Audience, visibility, permission

**Shared Information Target Scope**:
The target scope attached to a piece of active shared information. Updating shared information does not change its target scope; changing the target scope means removing the old shared information and adding new shared information.
_Avoid_: Retargeting, audience edit

**Shared Information Kind**:
The type of active shared information, such as task, timetable change, or note. Updating shared information does not change its kind; changing the kind means removing the old shared information and adding new shared information.
_Avoid_: Category edit, type conversion

**Creator Scope**:
The rule that a student can propose or directly make changes to shared information, collections, or threads only for a target scope that includes that student. Choosing a reference scope does not expand creator scope.
_Avoid_: Reference scope, admin permission, ownership

**Group**:
A future target scope for students who share an activity or affiliation outside grade, class, and track, such as a club. Groups are reserved for later and are not part of the initial core.
_Avoid_: Class, track, chat group

**Thread**:
A discussion inside the school community with a required target scope. A thread may optionally be attached to shared information such as a task, timetable change, request, or test result collection.
_Avoid_: Chat, board, social media post

## Example Dialogue

Developer: How does Tsugi know a student's class and track?
Domain expert: The student selects their own affiliation when creating their student account.

Developer: Does entering a school email number create a student account?
Domain expert: No. It only requests a verification code. The student account is created after the student proves access to the school email and completes the required account details.

Developer: Is Tsugi using magic links for authentication?
Domain expert: No. Tsugi uses verification codes sent to school email.

Developer: If the same student proposes several accepted tasks, does that student get a public reputation score?
Domain expert: No. Approvals and rejections belong to change proposals, not to student reputation.

Developer: Does approving a task proposal mean the student likes the task or has completed it?
Domain expert: No. An approval only means the student thinks the proposed change should become active shared information.

Developer: Can a student outside the target scope approve a timetable change proposal?
Domain expert: No. Only students inside the target scope can approve or reject the change proposal.

Developer: Is a test result collection the school's official grade record?
Domain expert: No. Students submit their own results for community aggregation and personalised reports.

Developer: Can a student create a request for another class they do not belong to?
Domain expert: No. The target scope must include the creator.

Developer: Can a student post a timetable change for a friend's class?
Domain expert: No. Timetable changes and tasks follow creator scope too; someone in that target scope should create it.

Developer: What does "月1" mean in a timetable change?
Domain expert: It is a period reference. It means the lesson name from period 1 on Monday in the standard timetable.

Developer: What does "★" mean in a timetable change?
Domain expert: It is a floating lesson reference. It is not tied to a weekday and period number, but it resolves to a lesson name for the student's class or track.

Developer: Can a grade-wide timetable change use "★" when different classes have different values for it?
Domain expert: Yes. The same timetable change resolves "★" for each student's class and track. Use a direct lesson name when every recipient should see the same name.

Developer: Does the standard timetable change each term?
Domain expert: No. The standard timetable is owned by the school year; term-like differences are timetable changes from that baseline.

Developer: What should a student check first in Tsugi?
Domain expert: Their daily plan, because it shows the timetable, tasks, and notes that apply to them for the day.

Developer: When should a student use a multi-day plan instead?
Domain expert: When they want to see the shape of several school days across multiple daily plans.

Developer: Is active shared information the source of truth?
Domain expert: No. Active shared information is the current state students see, while shared information changes explain how that state came to be.

Developer: Can a student inspect another class's timetable?
Domain expert: Yes, by choosing that class as a reference scope. It does not make that other class's entries part of the student's own target scopes.

Developer: Can a student create a timetable change for a reference scope?
Domain expert: No. Reference scope is for inspection; creator scope still requires the target scope to include the student.

Developer: If a student-level timetable change overrides a class-level change, does the class-level active shared information disappear?
Domain expert: No. The student sees the student-level entry in the displayed timetable, but can still inspect the broader class-level entry.

Developer: Is bringing a calculator tomorrow an assignment?
Domain expert: No. In Tsugi it is a task, because tasks include more than homework.

Developer: Does every task need to be tied to a lesson?
Domain expert: No. A task has a target scope and due date; a daily lesson or lesson name is only an optional relation.

Developer: Can a task be due at a period-level timing such as "before third period"?
Domain expert: Not as formal task data. A task's due timing is date-level; period-level instructions can be written in a note related to that task.

Developer: Can a task be related to a lesson name without being related to one daily lesson on one school date?
Domain expert: Yes. A task may be related to a lesson name, a specific daily lesson, both, or neither.

Developer: If a student marks a task complete, does that approve the task information?
Domain expert: No. Task completion is personal progress, while approval is about accepting a proposed change to shared information.
