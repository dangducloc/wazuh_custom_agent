//
import dotenv from "dotenv";
dotenv.config();
import { api } from "./api/api.js";

api.listen(process.env.PROXY_PORT || 3000, () => {
    console.log(
        `Proxy server is running on port ${process.env.PROXY_PORT || 3000}`,
    );
});
