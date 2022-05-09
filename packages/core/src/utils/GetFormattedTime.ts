export default function getFormattedTime(milliseconds: number): string {
    let date = new Date(0);
    date.setSeconds(milliseconds); // specify value for SECONDS here
    let timeString = date.toISOString().substr(11, 12);
    return timeString;
}
