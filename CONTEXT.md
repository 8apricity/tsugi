# Jikanwari

Jikanwari is a closed school community app for students at one high school. It exists to share school-life information such as timetable changes, tasks, and notes, and may later support requests, test-result collection, personalised reports, and discussion threads.
Its initial core is helping students understand their current timetable and tasks through active shared information, change proposals, direct changes, approvals, and rejections.

## Language

**School Community**:
A closed usage boundary for students who belong to one high school. Timetables, assignments, surveys, test results, reports, and threads are shared or collected inside this school community.
_Avoid_: Multi-school platform, social network, bulletin board app

**Student**:
A person who attends the high school and can participate in the school community. Students are the only members of Jikanwari.
_Avoid_: User, member, teacher, administrator

**Student Account**:
The account a student uses to participate in Jikanwari. A student account is eligible by the full school email address pattern, not by domain alone.
_Avoid_: User account, anonymous account, shared account, domain-only account, Google account

**School Email**:
The school-issued email address used to determine whether a student can create a student account. Parts of the school email may identify cohort-like or stable student information, but Jikanwari does not use them to infer affiliation or expose them as student identity.
_Avoid_: Personal email, affiliation source, public identifier

**Display Name**:
The name shown for a student in ordinary Jikanwari activity, usually a nickname rather than the student's real name.
_Avoid_: Real name, legal name, account name

**Real Name**:
The student's actual name, used only where a named response needs to identify who answered.
_Avoid_: Display name, nickname

**Named Attribution**:
Showing a student's display name as the source of ordinary Jikanwari activity. Direct changes use named attribution, while change proposals, approvals, and rejections do not show the individual students behind them.
_Avoid_: Real-name attribution, anonymous identity, reputation

**Student Affiliation**:
A student's self-selected grade, class, and track inside the school community. Student affiliation determines which target scopes currently apply to the student and can be changed by the student.
_Avoid_: Profile, role, permission

**Affiliation Renewal**:
The student's self-selection of their grade, class, and track for a new school year. Jikanwari does not automatically promote affiliations across school years; before renewal, prior-year information may be reference-only rather than part of the current daily plan.
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
Shared information that has been accepted and is currently reflected in a student's daily plan or reference view. Active shared information may later be changed or removed through another accepted change proposal.
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
A student's displayed schedule for a school day, week, or school year, produced from a standard timetable and later timetable changes. A timetable can differ by grade, class, track, and individual student.
_Avoid_: Calendar, event list

**Daily Plan**:
A student's day-level view of their timetable and tasks after applying relevant timetable layers and target scopes. The daily plan is the primary way a student checks what they need to attend or complete.
_Avoid_: Calendar, dashboard, home feed

**Reference View**:
A way for a student to inspect shared information outside their own target scopes. Reference views may be useful for group-scoped timetables and tasks, while individual-scoped tasks, threads, and test result collections stay limited to their target scope.
_Avoid_: Daily plan, public feed, unrestricted access

**Standard Timetable**:
The baseline recurring timetable for a class and track in a school year. Timetable changes refer back to this baseline with period references such as "Monday period 1".
_Avoid_: Default calendar, school-wide timetable

**Timetable Change**:
A date-specific change that modifies part of the standard timetable for a target scope. Timetable changes can be grade-wide, class-specific, track-specific, student-specific, planned in advance, or sudden.
_Avoid_: Calendar event, announcement, emergency change

**School Year**:
The academic year that owns a standard timetable for each class and track.
_Avoid_: Grade, term, semester

**Change Date**:
The school date on which a timetable change applies. A change date may replace that day's lesson order with period references from the standard timetable.
_Avoid_: Effective period, version

**Timetable Layer**:
A scope-specific source of timetable changes, ordered from broader to narrower scope: standard timetable, grade, class, track, student, and optionally group. Narrower timetable layers override broader layers for the displayed timetable, while broader-layer entries remain inspectable.
_Avoid_: Calendar layer, priority, category

**Track**:
A curriculum grouping under a class that can split the standard timetable. Track names may appear across multiple classes, but Jikanwari currently treats track as subordinate to class for target scopes.
_Avoid_: Course, subject, class

**Lesson Slot**:
A position in the standard timetable identified by weekday and period number. A period reference points to a lesson slot and resolves to the lesson assigned to that slot.
_Avoid_: Class period, clock time

**Lesson**:
The class activity assigned to a lesson slot, usually a subject or homeroom activity. A lesson is what students see after a period reference is resolved.
_Avoid_: Subject, period, course

**Lesson Name**:
The name of a lesson, such as Mathematics, English, or homeroom. A due reference can use a lesson name to find the next matching lesson in the displayed timetable.
_Avoid_: Subject, course

**Period Reference**:
A shorthand reference to a lesson slot in the standard timetable, such as "Monday period 1". Period references are used when describing timetable changes.
_Avoid_: Subject name, clock time

**Task**:
A school-life obligation shared inside the school community with a due date and target scope. A task may be homework, preparation, a form to submit, something to bring, or another action students need to complete, and may optionally be related to a lesson. A task can have an individual student as its target scope without becoming a separate personal-task concept.
_Avoid_: Assignment, homework, todo

**Note**:
Shared information that records a school-life notice or reminder without being a task or timetable change. A note has a target scope and may have no related context or one related context: a school date, a lesson slot, or a task.
_Avoid_: Announcement, comment, memo

**Due Reference**:
A shorthand way to set a task due date from the next or second-next matching lesson in the displayed timetable. A due reference uses a lesson name to decide what counts as the next lesson, and should only be used when it resolves to one due date for the task's target scope.
_Avoid_: Reminder, recurrence, deadline rule

**Task Completion**:
A student's personal completion state for a task. Task completion belongs to the student, not to the shared task itself.
_Avoid_: Task status, confirmation, submission

**Target Scope**:
The group of students a timetable change, task, request, test-result collection, report, or thread applies to. A target scope may be grade, class, track, student, or group.
_Avoid_: Audience, visibility, permission

**Shared Information Target Scope**:
The target scope attached to a piece of active shared information. Updating shared information does not change its target scope; changing the target scope means removing the old shared information and adding new shared information.
_Avoid_: Retargeting, audience edit

**Shared Information Kind**:
The type of active shared information, such as task, timetable change, or note. Updating shared information does not change its kind; changing the kind means removing the old shared information and adding new shared information.
_Avoid_: Category edit, type conversion

**Creator Scope**:
The rule that a student can propose or directly make changes to shared information, collections, or threads only for a target scope that includes that student.
_Avoid_: Admin permission, ownership

**Group**:
A future target scope for students who share an activity or affiliation outside grade, class, and track, such as a club. Groups are reserved for later and are not part of the initial core.
_Avoid_: Class, track, chat group

**Thread**:
A discussion inside the school community with a required target scope. A thread may optionally be attached to shared information such as a task, timetable change, request, or test result collection.
_Avoid_: Chat, board, social media post

## Example Dialogue

Developer: How does Jikanwari know a student's class and track?
Domain expert: The student selects their own affiliation when creating their student account.

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
Domain expert: It means the subject or lesson from period 1 on Monday in the standard timetable.

Developer: Does the standard timetable change each term?
Domain expert: No. The standard timetable is owned by the school year; term-like differences are timetable changes from that baseline.

Developer: What should a student check first in Jikanwari?
Domain expert: Their daily plan, because it shows the timetable and tasks that apply to them for the day.

Developer: Is active shared information the source of truth?
Domain expert: No. Active shared information is the current state students see, while shared information changes explain how that state came to be.

Developer: Can a student inspect another class's timetable?
Domain expert: Yes, through a reference view. It does not make that other class's entries part of the student's daily plan.

Developer: If a student-level timetable change overrides a class-level change, does the class-level active shared information disappear?
Domain expert: No. The student sees the student-level entry in the displayed timetable, but can still inspect the broader class-level entry.

Developer: Is bringing a calculator tomorrow an assignment?
Domain expert: No. In Jikanwari it is a task, because tasks include more than homework.

Developer: Does every task need to be tied to a lesson?
Domain expert: No. A task has a target scope and due date; a lesson is only an optional relation, though it can help fill due dates such as "next time".

Developer: Can a class-wide task use "next math" if different tracks have math on different days?
Domain expert: No. The task should use a narrower target scope or a direct due date so the shared task has one due date.

Developer: If a student marks a task complete, does that approve the task information?
Domain expert: No. Task completion is personal progress, while approval is about accepting a proposed change to shared information.
