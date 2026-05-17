import { Router } from "express";
import conversationsRouter from "./conversations";
import imageRouter from "./image";

const openaiRouter = Router();

openaiRouter.use(conversationsRouter);
openaiRouter.use(imageRouter);

export default openaiRouter;
