import { MEMBERSHIP_FEES } from './membershipFees';

/** Shown when /site/join-us cannot be loaded (offline, native tester builds, etc.). */
export const DEFAULT_JOIN_US_CONTENT = {
  goal: {
    title: 'Our Goal',
    body: 'To promote triathlon to the University of Toronto community through swim, bike, and run workouts which are both fun and challenging.',
  },
  whoCanJoin: {
    title: 'Who Can Join?',
    intro:
      'The University of Toronto Triathlon Club is open to students, alumni, faculty, and community members of the U of T Athletic Centre who are 18 years and older (exceptions are made for current U of T students who are 17.) We welcome athletes of all abilities from experienced triathletes to those new to the sport. The club operates year round, offering professionally coached swim and run workouts and member-led bike/spin workouts.',
    athleteTypesTitle: 'Athlete Types',
    athleteTypesIntro:
      'The U of T Tri Club is suitable for a range of current and aspiring triathletes (18yrs+) which include:',
    categories: [
      {
        title: '🏃‍♂️ Recreational Athletes',
        body: 'Those who are new to endurance sports and are primarily interested in triathlon training to get back in shape.',
      },
      {
        title: '🏊‍♂️ Short Course Athletes',
        body: 'Those who have some experience in endurance sports and are primarily interested in competing in Sprint and Olympic distance triathlons/duathlons or 5k/10k running races.',
      },
      {
        title: '🚴‍♂️ Long Course Athletes',
        body: 'Those who have some experience in endurance sports and are primarily interested in competing in Long Course to Ironman distance triathlons or half-marathon/marathon running races.',
      },
    ],
    beginnerNote: {
      title: '⚠️ Beginners Please Note',
      body: 'You must be able to swim 300m continuous before you attend the swim workouts. If you are new to swimming, the AC offers various swim classes to get you started.',
    },
  },
  howToJoin: {
    title: 'Joining: Step-by-step Instructions',
    steps: [
      {
        title: 'Try Us Out',
        body: 'Attend any one of our workouts to meet us and try it out! For indoor spin workouts, email [info@uoft-tri.club](mailto:info@uoft-tri.club) to make sure there is a bike reserved for you.',
      },
      {
        title: 'Join the U of T Athletics Centre (AC)',
        body: 'You must be an AC-member to join the Tri Club (provides access to training facilities, including pool). U of T students are automatically AC-members during the Fall and Winter terms. Otherwise, AC-membership can be purchased at the AC Main Office.',
      },
      {
        title: 'Join the Tri Club',
        body: 'To register for the Tri Club go to [recreation.utoronto.ca](https://recreation.utoronto.ca) or register in person at the AC Main Office.',
        showPackages: true,
        packagesHeading: 'There are 3 packages available:',
        packages: [
          'Triathlon (Swim, Run + Spin Workouts)',
          'Duathlon (Run + Spin Workouts)',
          'Run only',
        ],
        feesHeading: 'Fees:',
        feesNote: '*Half = Fall or Winter only | Full = Both Fall and Winter',
        fees: MEMBERSHIP_FEES,
        registrationHeading: 'Current 2025/26 Registration Links:',
        registrationBody:
          '[Register here](https://recreation.utoronto.ca). "Club Sports: Triathlon Club" You must have a AC membership to join the Triathlon Club.',
      },
      {
        title: 'Create an Account and Get Approved',
        body: "Create an account on this website, then go to your [Profile](/profile) page and upload your membership payment receipt (image or PDF). An exec will review it and approve you as a member—no need to email it. After you're approved, log out and log back in so you can access the forum and sign up for spin and brick workouts.",
      },
      {
        title: 'Come to the workouts!',
        body: 'For all other inquiries or questions please email [info@uoft-tri.club](mailto:info@uoft-tri.club)',
      },
    ],
  },
};
