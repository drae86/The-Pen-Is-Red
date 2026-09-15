import { Router, type IRouter } from "express";
import healthRouter from "./health";
import analysesRouter from "./analyses";
import parseDocumentRouter from "./parse-document";

const router: IRouter = Router();

router.use(healthRouter);
router.use(analysesRouter);
router.use(parseDocumentRouter);

export default router;
