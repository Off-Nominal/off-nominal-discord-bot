require("dotenv").config();

import { Client, Intents } from "discord.js";

import bcBotHandlers from "./clients/bookclub/handlers";
import mainBotHandlers from "./clients/main/handlers";
import contentBotHandlers from "./clients/content/handlers";

import { FeedListener } from "./listeners/feedListener/feedListener";
import { feedMapper } from "./listeners/feedListener/feedMapper";
import { SiteListener } from "./listeners/siteListener";
import { ReportGenerator } from "./utilities/ReportGenerator";
import { ChannelBabysitter } from "./utilities/channelBabysitter";
import deployWeMartians from "./utilities/deployWeMartians";

const searchOptions = require("../config/searchOptions.json");

const TEST_CHANNEL = process.env.TESTCHANNEL;

const BOCACHICACHANNELID = process.env.BOCACHICACHANNELID || TEST_CHANNEL;
const LIVECHATCHANNELID = process.env.LIVECHATCHANNELID || TEST_CHANNEL;

const WMFEED = process.env.WMFEED;
const MECOFEED = process.env.MECOFEED;
const OFNFEED = process.env.OFNFEED;
const RPRFEED = process.env.RPRFEED;
const HLFEED = process.env.HLFEED;

const UTILITY_TOKEN = process.env.UTILITY_BOT_TOKEN_ID;
const BC_TOKEN = process.env.BOOK_CLUB_BOT_TOKEN_ID;
const CONTENT_TOKEN = process.env.CONTENT_BOT_TOKEN_ID;

const WM_SEARCH_OPTIONS = searchOptions.wm || searchOptions.default;
const MECO_SEARCH_OPTIONS = searchOptions.meco || searchOptions.default;
const OFN_SEARCH_OPTIONS = searchOptions.ofn || searchOptions.default;
const RPR_SEARCH_OPTIONS = searchOptions.rpr || searchOptions.default;
const HL_SEARCH_OPTIONS = searchOptions.hl || searchOptions.default;

/***********************************
 *  Bot Setup
 ************************************/

const simpleIntents = new Intents();
const utilityIntents = new Intents();

simpleIntents.add(
  Intents.FLAGS.GUILDS,
  Intents.FLAGS.GUILD_MESSAGES,
  Intents.FLAGS.DIRECT_MESSAGES
);

utilityIntents.add(
  Intents.FLAGS.GUILD_MESSAGES,
  Intents.FLAGS.GUILDS,
  Intents.FLAGS.GUILD_MEMBERS,
  Intents.FLAGS.GUILD_MESSAGE_REACTIONS,
  Intents.FLAGS.DIRECT_MESSAGES
);

const utilityBot = new Client({
  partials: ["MESSAGE", "CHANNEL", "REACTION", "GUILD_MEMBER"],
  intents: utilityIntents,
});
const bcBot = new Client({
  intents: simpleIntents,
});
const contentBot = new Client({
  intents: simpleIntents,
});

/***********************************
 *  Site Listener Setup
 ************************************/

const starshipChecker = new SiteListener(
  "https://www.spacex.com/vehicles/starship/",
  utilityBot,
  BOCACHICACHANNELID,
  { interval: 15, cooldown: 600 }
);

/***********************************
 *  Feed Listener Setup
 ************************************/

const wmFeedListener = new FeedListener(WMFEED, {
  processor: feedMapper,
  searchOptions: WM_SEARCH_OPTIONS,
});
const mecoFeedListener = new FeedListener(MECOFEED, {
  processor: feedMapper,
  searchOptions: MECO_SEARCH_OPTIONS,
});
const ofnFeedListener = new FeedListener(OFNFEED, {
  processor: feedMapper,
  searchOptions: OFN_SEARCH_OPTIONS,
});
const rprFeedListener = new FeedListener(RPRFEED, {
  processor: feedMapper,
  searchOptions: RPR_SEARCH_OPTIONS,
});
const hlFeedListener = new FeedListener(HLFEED, {
  processor: feedMapper,
  searchOptions: HL_SEARCH_OPTIONS,
});

/***********************************
 *  UTILITY SETUPS
 ************************************/

const reportGenerator = new ReportGenerator();
const channelBabysitter = new ChannelBabysitter(utilityBot, LIVECHATCHANNELID);

/***********************************
 *  ASYNC LOGINS/INITS
 ************************************/

utilityBot.login(UTILITY_TOKEN);
bcBot.login(BC_TOKEN);
contentBot.login(CONTENT_TOKEN);

wmFeedListener.initialize();
mecoFeedListener.initialize();
ofnFeedListener.initialize();
rprFeedListener.initialize();
hlFeedListener.initialize();

starshipChecker.initialize();

/***********************************
 *  Utility Bot Event Handlers
 ************************************/

utilityBot.once("ready", (client) => {
  mainBotHandlers.handleReady(client);
  channelBabysitter.initialize();
});
utilityBot.on("messageCreate", mainBotHandlers.handleMessageCreate);
utilityBot.on("guildMemberAdd", mainBotHandlers.handleGuildMemberAdd);
utilityBot.on("messageReactionAdd", (messageReact, user) => {
  mainBotHandlers.handleMessageReactionAdd(messageReact, user, {
    channelBabysitter,
  });
});
utilityBot.on("threadCreate", mainBotHandlers.handleThreadCreate);
utilityBot.on("interactionCreate", mainBotHandlers.handleInteractionCreate);
utilityBot.on("summaryReportCreate", reportGenerator.handleReportRequest);
utilityBot.on("summaryReportSend", reportGenerator.handleSendRequest);

/***********************************
 *  Book Club Bot Event Handlers
 ************************************/

bcBot.once("ready", bcBotHandlers.handleReady);
bcBot.on("messageCreate", bcBotHandlers.handleMessageCreate);
bcBot.on("threadCreate", bcBotHandlers.handleThreadCreate);
bcBot.on("interactionCreate", bcBotHandlers.handleInteractionCreate);

/***********************************
 *  Feed Listeners Event Handlers
 ************************************/

wmFeedListener.on("newContent", (newContent) => {
  deployWeMartians();
  contentBotHandlers.handleNewContent(newContent, contentBot, 600);
});
mecoFeedListener.on("newContent", (newContent) => {
  contentBotHandlers.handleNewContent(newContent, contentBot);
});
ofnFeedListener.on("newContent", (newContent) => {
  contentBotHandlers.handleNewContent(newContent, contentBot);
});
rprFeedListener.on("newContent", (newContent) => {
  contentBotHandlers.handleNewContent(newContent, contentBot);
});
hlFeedListener.on("newContent", (newContent) => {
  contentBotHandlers.handleNewContent(newContent, contentBot);
});

/***********************************
 *  Podcast Bot Event Handlers
 ************************************/

const feeds = {
  wm: wmFeedListener,
  meco: mecoFeedListener,
  ofn: ofnFeedListener,
  rpr: rprFeedListener,
  hl: hlFeedListener,
};
contentBot.once("ready", contentBotHandlers.handleReady);
contentBot.on("threadCreate", contentBotHandlers.handleThreadCreate);
contentBot.on("interactionCreate", (interaction) =>
  contentBotHandlers.handleInteractionCreate(interaction, feeds)
);
