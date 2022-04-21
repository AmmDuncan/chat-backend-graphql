import { ApolloServer, gql } from "apollo-server-express";
import { ApolloServerPluginDrainHttpServer } from "apollo-server-core";
import { makeExecutableSchema } from "@graphql-tools/schema";
import { WebSocketServer } from "ws";
import { useServer } from "graphql-ws/lib/use/ws";
import express from "express";
import http from "http";
import { nanoid } from "nanoid";

import { Member, Message, Channel } from "./types";

const members: Member[] = [
  { name: "Ammiel Yawson", channels: ["Pubg"] },
  { name: "Samuel Amenyedor", channels: ["Pubg", "Apex"] },
  { name: "Daniel Amenyedor", channels: ["Pubg", "Apex"] },
];

let channels: Channel[] = [
  {
    name: "Pubg",
    fullName: "Players Underground Battleground",
    type: "Battleroyale",
    messages: [
      {
        id: 1,
        content: "Hi everyone!",
        author: "Ammiel Yawson",
        createdAt: dateString("2022-04-14"),
      },
      {
        id: 2,
        content: "Can we team up tonight?",
        author: "Ammiel Yawson",
        createdAt: dateString("2022-04-15"),
      },
      {
        id: 3,
        content:
          "Tonight? I got a tournament in Apex. We can set it up for this weekend tho. I'll be available.",
        author: "Samuel Amenyedor",
        createdAt: dateString("2022-04-16"),
        replyTo: 2,
      },
      {
        id: 4,
        content: "Yeah me too",
        author: "Daniel Amenyedor",
        createdAt: dateString("2022-04-17"),
        replyTo: 3,
      },
      {
        id: 5,
        content: "Sellouts 🌚",
        author: "Ammiel Yawson",
        createdAt: dateString("2022-04-18"),
        replyTo: 4,
      },
    ],
    members: ["Ammiel Yawson", "Samuel Amenyedor", "Daniel Amenyedor"],
  },
  {
    name: "Apex",
    fullName: "Apex Legends",
    type: "Battleroyale",
    members: ["Samuel Amenyedor", "Daniel Amenyedor"],
  },
];

const typeDefs = gql`
  type Message {
    id: ID!
    content: String!
    createdAt: String!
    author: Member!
    replyTo: Message
  }

  type Member {
    id: ID!
    name: String!
    channels: [Channel!]
  }

  type Channel {
    id: ID!
    name: String!
    fullName: String!
    type: String!
    members: [Member!]!
    messages: [Message!]
    membersCount: Int!
  }

  type Query {
    allMembers: [Member!]
    allChannels: [Channel!]
    channel(name: String!): Channel
  }

  type MMessage {
    content: String!
    replyTo: Int
  }

  type Mutation {
    addMessage(channelName: String!, content: String!, replyTo: String): Message
  }
`;

const resolvers = {
  Channel: {
    membersCount: (channel: Channel): number => channel.members.length,
    members: (channel: Channel): Member[] =>
      members.filter((member) => channel.members.includes(member.name)),
  },
  Message: {
    replyTo: (message: Message) => {
      let replyTo = null;
      if (message.replyTo) {
        channels.forEach((channel) => {
          if (channel.messages) {
            const found = channel.messages.find((msg) => {
              return msg.id === message.replyTo;
            });
            if (found) replyTo = found;
          }
        });
      }
      return replyTo;
    },
    author: (message: Message) =>
      members.find((m: Member) => m.name === message.author),
  },
  Member: {
    channels: (root: Member) =>
      channels.filter((channel) => root.channels.includes(channel.name)),
  },
  Query: {
    allMembers: () => members,
    allChannels: () => channels,
    channel: (_root: unknown, args: { name: string }) => {
      return channels.find(
        (channel) => channel.name.toLowerCase() === args.name.toLowerCase()
      );
    },
  },
  Mutation: {
    addMessage: (
      _root: unknown,
      args: {
        channelName: string;
        content: string;
        replyTo: string | number | null;
      }
    ) => {
      const channel = channels.find(byMatchingName(args));
      if (!channel) throw new Error(`Channel ${args.channelName} not found`);

      const message: Message = {
        id: nanoid(),
        content: args.content,
        createdAt: new Date().toISOString(),
        replyTo: args.replyTo,
        author: "Ammiel Yawson",
      };

      channel.messages = channel.messages
        ? [...channel.messages, message]
        : [message];

      channels = channels.map((ch) =>
        ch.name === args.channelName ? channel : ch
      );
      return message;
    },
  },
};

const app = express();
const httpServer = http.createServer(app);
const schema = makeExecutableSchema({ typeDefs, resolvers });
const wsServer = new WebSocketServer({ server: httpServer, path: "/graphql" });

const serverCleanup = useServer({ schema }, wsServer);

async function initServer() {
  const server = new ApolloServer({
    schema,
    plugins: [
      ApolloServerPluginDrainHttpServer({ httpServer }),
      {
        async serverWillStart() {
          return {
            async drainServer() {
              await serverCleanup.dispose();
            },
          };
        },
      },
    ],
  });

  await server.start();
  server.applyMiddleware({ app });

  httpServer.listen({ port: 4000 }, () =>
    console.log(`🚀 Server ready at http://localhost:4000${server.graphqlPath}`)
  );
}

initServer();

/**
 * @param str {String} - date in format YYYY-MM-DD
 * @returns {String} ISO date string
 */
function dateString(str: string): string {
  return new Date(Date.parse(str)).toISOString();
}

function byMatchingName(args: { channelName: string }) {
  return (channel: Channel) => channel.name === args.channelName;
}
