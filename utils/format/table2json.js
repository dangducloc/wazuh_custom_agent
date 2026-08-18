// /utils/format/table2json.js
// This file contains a utility function that converts a table-like string into a JSON object. The function takes a string input, splits it into lines, and processes each line to extract key-value pairs. It returns an array of objects representing the data in the table format.
const sampleTable = 
`health status index                       uuid                   pri rep docs.count docs.deleted store.size pri.store.size
green  open   wazuh-alerts-4.x-2026.08.03 _ZUQgJJhSVuYMno8mY_fpw   3   0        111            0    464.5kb        464.5kb
green  open   wazuh-alerts-4.x-2026.08.04 MoQZHonZRKWztmmvC-tb9w   3   0          6            0     86.7kb         86.7kb
green  open   wazuh-alerts-4.x-2026.07.31 Y76aWuInQB6QSwr-VZidHg   3   0        780            0        2mb            2mb
green  open   wazuh-alerts-4.x-2026.08.01 oTzJ5xP4RJySmt8434YHaA   3   0        244            0    779.7kb        779.7kb
green  open   wazuh-alerts-4.x-2026.08.02 bHIxW94lQ7CWJiNaB3p3uQ   3   0         62            0    277.9kb        277.9kb`;

export function table2Json(tableString) {
    const lines = tableString.trim().split('\n');
    const headers = lines[0].trim().split(/\s+/);
    const result = [];

    for (let i = 1; i < lines.length; i++) {
        const values = lines[i].trim().split(/\s+/);
        const obj = {};
        for (let j = 0; j < headers.length; j++) {
            obj[headers[j]] = values[j];
        }
        result.push(obj);
    }

    return result;
}
