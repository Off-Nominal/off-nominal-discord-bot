import { CacheType, ChatInputCommandInteraction } from "discord.js";
import { Client } from "pg";
import { LogStatus, Logger } from "../../../utilities/logger";
import { LogInitiator } from "../../../types/logEnums";
import { ndb2Client } from "../../../utilities/ndb2Client";
import { generateScoresEmbed } from "../actions/embedGenerators/generateScoresEmbed";
import fetchGuild from "../../../utilities/fetchGuild";

export default function generateHandleViewScore(db: Client) {
  return async function handleVewScore(
    interaction: ChatInputCommandInteraction<CacheType>
  ) {
    const logger = new Logger(
      "NDB2 Interaction",
      LogInitiator.NDB2,
      "View Score"
    );

    // Score calculcations can sometimes take time, this deferred reply let's discord know we're working on it!
    try {
      await interaction.deferReply();
      logger.addLog(LogStatus.SUCCESS, "Successfully deferred reply.");
    } catch (err) {
      logger.addLog(LogStatus.FAILURE, "Failed to defer reply, aborting.");
      return logger.sendLog(interaction.client);
    }

    const discord_id = interaction.user.id;

    try {
      const response = await ndb2Client.getScores(discord_id);
      logger.addLog(LogStatus.SUCCESS, "Successfully fetched scores from API.");

      const scores = response.data;
      const guild = fetchGuild(interaction.client);
      const member = await guild.members.fetch(interaction.user.id);
      logger.addLog(LogStatus.SUCCESS, "Successfully fetched Guild Member");
      const embed = generateScoresEmbed(scores, member);
      await interaction.editReply({ embeds: [embed] });
      logger.addLog(
        LogStatus.SUCCESS,
        "Successfully posted scores embed to Discord"
      );
    } catch (err) {
      await interaction.editReply({
        content: "There was an error fetching scores from the API.",
      });
      logger.addLog(LogStatus.FAILURE, "Failed to fetch scores from API");
    }

    logger.sendLog(interaction.client);
  };
}