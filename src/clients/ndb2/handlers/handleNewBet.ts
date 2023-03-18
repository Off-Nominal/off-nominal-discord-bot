import { ButtonInteraction, time, userMention } from "discord.js";
import { LogInitiator } from "../../../types/logEnums";
import { Logger, LogStatus } from "../../../utilities/logger";
import { ndb2Client } from "../../../utilities/ndb2Client";
import { NDB2API } from "../../../utilities/ndb2Client/types";
import { ButtonCommand } from "./handleInteractionCreate";

export default async function handleNewBet(
  interaction: ButtonInteraction,
  predictionId: string,
  command: string
) {
  const logger = new Logger("NDB2 Interaction", LogInitiator.NDB2, "New Bet");

  const discordId = interaction.member.user.id;
  const endorsed = command === ButtonCommand.ENDORSE;

  logger.addLog(
    LogStatus.INFO,
    `New ${command} made by ${userMention(
      discordId
    )} on prediction #${predictionId}`
  );

  let prediction: NDB2API.EnhancedPrediction;

  // Add Bet
  try {
    prediction = await ndb2Client.addBet(predictionId, discordId, endorsed);
    logger.addLog(LogStatus.SUCCESS, `Bet was successfully submitted to NDB2`);
  } catch (err) {
    logger.addLog(
      LogStatus.FAILURE,
      `There was an error submitting the bet. ${err.response.data.message}`
    );
    console.error(err);
    return interaction.reply({
      ephemeral: true,
      content: `There was an error submitting the bet to NDB2. ${err.response.data.message}`,
    });
  }

  try {
    interaction.reply({
      content: `Prediction $${predictionId} successfully ${command.toLowerCase()}d!`,
      ephemeral: true,
    });
    logger.addLog(
      LogStatus.SUCCESS,
      `Successfully notified user of bet success.`
    );
  } catch (err) {
    console.log(err);
    logger.addLog(
      LogStatus.FAILURE,
      `There was an error responding to the prediction in the channel, but the prediction was submitted. ${err.response.data.message}`
    );
  }

  logger.sendLog(interaction.client);
}
