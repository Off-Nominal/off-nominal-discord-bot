import { add, format, sub, isBefore } from "date-fns";
import {
  Collection,
  GuildScheduledEvent,
  GuildScheduledEventCreateOptions,
  GuildScheduledEventEditOptions,
  GuildScheduledEventEntityType,
  GuildScheduledEventManager,
  GuildScheduledEventPrivacyLevel,
  GuildScheduledEventStatus,
  time,
  TimestampStyles,
} from "discord.js";
import RocketLaunchLiveClient from "../../utilities/rocketLaunchLiveClient/rocketLaunchLiveClient";
import { Launch } from "../../utilities/rocketLaunchLiveClient/types";

const FIVE_MINS_IN_MS = 300000;

const generateDescription = (launch: Launch): string => {
  const windowOpen = new Date(launch.win_open);
  const infoString = `\n\nStream is set to begin 15 minutes before liftoff time of ${time(
    windowOpen,
    TimestampStyles.LongDateTime
  )}, in ${time(windowOpen, TimestampStyles.RelativeTime)}`;
  const idString = `\n\nrllId=[${launch.id.toString()}]\n\nData provided by RocketLaunch.live`;
  return launch.launch_description + infoString + idString;
};

const getStreamUrl = (launch: Launch) => {
  const streamMedia = launch.media.find(
    (media) => media.ldfeatured || media.featured
  );

  if (!streamMedia) {
    return "Unavailable";
  }

  return streamMedia.youtube_vidid
    ? `https://www.youtube.com/watch?v=${streamMedia.youtube_vidid}`
    : streamMedia.media_url;
};

export default class LaunchListener {
  private events: Map<number, GuildScheduledEvent>;
  private client: RocketLaunchLiveClient;
  private eventsManager: GuildScheduledEventManager;

  constructor() {
    this.events = new Map<number, GuildScheduledEvent>();
    this.client = new RocketLaunchLiveClient();
  }

  public initialize(
    events: Collection<string, GuildScheduledEvent>,
    eventsManager: GuildScheduledEventManager
  ) {
    this.eventsManager = eventsManager;
    console.log(`* Initializing with ${events.size} events`);
    events.forEach((event) => {
      const rllId = event.description.match(new RegExp(/(?<=\[)(.*?)(?=\])/gm));

      if (rllId && rllId.length) {
        this.events.set(Number(rllId[0]), event);
      }
    });
    console.log(`* Only ${this.events.size} events are launches.`);
    this.syncEvents().then(() => this.monitor());
  }

  private syncEvents() {
    // GET ALL EVENTS WITHIN 7 DAYS
    const now = new Date();
    const window = add(now, { days: 7 });

    return this.client
      .fetchLaunches({
        before_date: format(window, "yyyy-MM-dd"),
        after_date: format(now, "yyyy-MM-dd"),
      })
      .then((results) => {
        console.log(
          `* Sync activity fetched ${results.length} events from RLL`
        );
        const promises: Promise<Launch | GuildScheduledEvent | void>[] = [];

        results.forEach((launch) => {
          // ignore if it has no opening time
          // we're only creating events for launches with scheduled liftoff times
          if (!launch.win_open) {
            console.log(`* Ignoring ${launch.name}, no launch window open`);
            return;
          }

          // ignore win open in the past
          const winOpen = new Date(launch.win_open);
          if (isBefore(winOpen, now)) {
            console.log(`* Ignoring ${launch.name}, launch window in the past`);
            return;
          }

          const event = this.events.get(launch.id);

          if (event) {
            // sync it if it already exists
            promises.push(this.syncEvent(event, launch));
          } else {
            const windowOpen = new Date(launch.win_open);
            const options: GuildScheduledEventCreateOptions = {
              name: launch.name,
              scheduledStartTime: sub(windowOpen, { minutes: 15 }),
              scheduledEndTime: launch.win_close
                ? add(new Date(launch.win_close), { minutes: 15 })
                : add(windowOpen, { minutes: 60 }),
              privacyLevel: GuildScheduledEventPrivacyLevel.GuildOnly,
              entityType: GuildScheduledEventEntityType.External,
              description: generateDescription(launch),
              entityMetadata: { location: getStreamUrl(launch) },
            };
            console.log(`* Adding ${launch.name}`);
            const promise = this.eventsManager.create(options).then((event) => {
              this.events.set(launch.id, event);
              return event;
            });
            promises.push(promise);
          }
        });

        // Sync any events that are not in the API call (which may have moved)

        const fetchedIds = results.map((result) => result.id);
        this.events.forEach((event, rllId) => {
          if (!fetchedIds.includes(rllId)) {
            const promise = this.client
              .fetchLaunches({ id: rllId.toString() })
              .then((launch) => {
                this.syncEvent(event, launch[0]);
                return launch[0];
              });

            promises.push(promise);
          }
        });

        return Promise.allSettled(promises);
      })
      .then(() => {
        return console.log("* Discord Events and RocketLaunch.live now synced");
      })
      .catch((err) => console.error(err));
  }

  private monitor() {
    setInterval(() => {
      this.syncEvents();
    }, FIVE_MINS_IN_MS);
  }

  private syncEvent(event: GuildScheduledEvent, launch: Launch) {
    // Edge case for when a launch goes from a specific scheduled time in the next week to unscheduled
    if (!launch.win_open) {
      return event.delete();
    }

    const newData: GuildScheduledEventEditOptions<
      GuildScheduledEventStatus.Scheduled,
      GuildScheduledEventStatus.Active
    > = {};

    // Location
    const url = getStreamUrl(launch);
    if (event.entityMetadata.location !== url) {
      newData.entityMetadata = { location: url };
    }

    // Topic
    if (event.name !== launch.name) {
      newData.name = launch.name;
    }

    // Start Time
    const windowOpen = new Date(launch.win_open);
    const eventStreamStart = event.scheduledStartAt;
    if (
      add(eventStreamStart, { minutes: 15 }).toISOString() !==
        windowOpen.toISOString() &&
      !event.isActive()
    ) {
      newData.scheduledStartTime = sub(windowOpen, { minutes: 15 });
      newData.description = generateDescription(launch);
      const scheduledEndTime = launch.win_close
        ? add(new Date(launch.win_close), {
            minutes: 15,
          })
        : add(windowOpen, {
            minutes: 60,
          });

      newData.scheduledEndTime = scheduledEndTime;
    }

    // Event has no changes
    if (!Object.keys(newData).length) {
      return;
    }

    console.log(`Updating ${launch.name}`);
    console.log("New data: ", newData);
    return event.edit(newData).catch((err) => console.error(err));
  }
}
