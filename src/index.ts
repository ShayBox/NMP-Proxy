import { startHub } from './hub';

startHub({ port: parseInt(process.env.PORT || "25565") });
