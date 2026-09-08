// /test/mitre.test.js
import {
    getMitreMetadata,
    listMitreTactics,
    listMitreTechniques,
    listMitreMitigations,
    listMitreSoftware,
    listMitreGroups,
    listMitreReferences,
} from "../tools/wazuh/api/mitre/mitre-tools.js";
import { describe, it } from "node:test";
import { logger } from "../utils/index.js";

describe("mitre tools", () => {
    it("should return a successful response for fetch mitre metadata", async () => {
        const result = await getMitreMetadata();
        logger.info({ result }, "MITRE Metadata");
    });

    it("should return a successful response for fetch mitre tactics", async () => {
        const result = await listMitreTactics();
        logger.info({ count: result.length }, "MITRE Tactics");
    });

    it("should return a successful response for fetch mitre techniques by ids", async () => {
        const sample = (await listMitreTechniques([], {}, false, 1))[0];
        const result = await listMitreTechniques([sample.id]);
        logger.info(
            { count: result.length, id: sample.id },
            "MITRE Techniques",
        );
    });

    it("should return a successful response for fetch mitre mitigations", async () => {
        const result = await listMitreMitigations();
        logger.info({ count: result.length }, "MITRE Mitigations");
    });

    it("should return a successful response for fetch mitre software", async () => {
        const result = await listMitreSoftware();
        logger.info({ count: result.length }, "MITRE Software");
    });

    it("should return a successful response for fetch mitre groups", async () => {
        const result = await listMitreGroups();
        logger.info({ count: result.length }, "MITRE Groups");
    });

    it("should return a successful response for fetch mitre references", async () => {
        const result = await listMitreReferences();
        logger.info({ count: result.length }, "MITRE References");
    });
});
