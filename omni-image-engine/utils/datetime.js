function pad(n) {
    return n < 10 ? "0" + n : "" + n;
}

function formatDateTimeForFilename(date) {
    const year = date.getFullYear();
    const month = pad(date.getMonth() + 1);
    const day = pad(date.getDate());
    const hours = pad(date.getHours());
    const minutes = pad(date.getMinutes());
    const seconds = pad(date.getSeconds());

    return `${year}-${month}-${day}_${hours}-${minutes}-${seconds}`;
}

module.exports = {
    formatDateTimeForFilename
};
