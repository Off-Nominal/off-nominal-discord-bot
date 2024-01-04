import { Providers } from "../../../providers";
import { generateNotificationEmbed } from "../../ndb2/actions/embedGenerators/generateNotificationEmbed";
import fetchGuild from "../../../helpers/fetchGuild";
import { LogInitiator, LogStatus, Logger } from "../../../logger/Logger";
import { API } from "../../../providers/db/models/types";

export default function NewNDBPredictionNotifications({
  models,
  ndb2Bot,
  notifications,
}: Providers) {
  notifications.on("ndb_new", async (prediction, messageLink) => {
    const logger = new Logger(
      "New Notification Event",
      LogInitiator.NDB2,
      "ndb_new"
    );

    const embed = generateNotificationEmbed({
      type: "ndb_new",
      text: prediction.text,
      messageLink,
      predictionId: prediction.id,
    });

    const guild = fetchGuild(ndb2Bot);

    let subscribers: API.UserNotification.FetchNewPredictionSubscribers[];

    try {
      subscribers =
        await models.userNotifications.fetchNewPredictionSubscribers({
          exclude: prediction.predictor.discord_id,
        });
      logger.addLog(
        LogStatus.SUCCESS,
        `${subscribers.length} Subscribers fetched`
      );
    } catch (err) {
      console.error(err);
      logger.addLog(LogStatus.FAILURE, "Failed to fetch subscribers");
      return;
    }

    try {
      await notifications.queueDMs(
        guild,
        subscribers.map((subscriber) => subscriber.discord_id),
        { embeds: [embed] }
      );
      logger.addLog(
        LogStatus.SUCCESS,
        `${subscribers.length} Subscribers notifications queued`
      );
    } catch (err) {
      console.error(err);
      logger.addLog(LogStatus.FAILURE, "Failed to send Notifications");
    }

    logger.sendLog(ndb2Bot);
  });
}
