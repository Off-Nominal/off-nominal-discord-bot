import { ButtonInteraction } from "discord.js";
import { Client } from "pg";
import { LogInitiator } from "../../../types/logEnums";
import { Logger, LogStatus } from "../../../utilities/logger";
import { ndb2Client } from "../../../utilities/ndb2Client";
import { NDB2API } from "../../../utilities/ndb2Client/types";
import { generatePredictionDetailsEmbed } from "../actions/embedGenerators/generatePredictionDetailsEmbed";

export default function generateHandleViewDetails(db: Client) {
  return async function handleViewDetails(
    interaction: ButtonInteraction,
    predictionId: string
  ) {
    const logger = new Logger(
      "NDB2 Interaction",
      LogInitiator.NDB2,
      "View Details"
    );

    let prediction: NDB2API.EnhancedPrediction;

    // Fetch prediction
    try {
      const response = await ndb2Client.getPrediction(predictionId);
      prediction = response.data;
      logger.addLog(LogStatus.SUCCESS, "Prediction successfully fetched");
    } catch ([userError, logError]) {
      interaction.reply({
        ephemeral: true,
        content: `There was an error fetching this subscription detail. ${userError}`,
      });
      logger.addLog(
        LogStatus.FAILURE,
        `There was an error fetching the prediction ${logError}`
      );
      return logger.sendLog(interaction.client);
    }

    const embed = generatePredictionDetailsEmbed(prediction);

    try {
      interaction.reply({
        embeds: [embed],
        ephemeral: true,
      });
      logger.addLog(
        LogStatus.SUCCESS,
        `Successfully notified user of prediction details.`
      );
    } catch (err) {
      console.error(err);
      logger.addLog(
        LogStatus.FAILURE,
        `There was an error sending the prediction details in the channel. ${err.response.data.message}`
      );
    }

    logger.sendLog(interaction.client);
  };
}
