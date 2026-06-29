import client from "../api/client";
import { endpoints } from "../api/endpoints";

export async function getReports() {

    const { data } = await client.get(
        endpoints.reports
    );

    return data;

}