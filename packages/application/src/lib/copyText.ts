const copyText = (str: string): void => {
    const el = document.createElement("textarea");

    el.value = str;

    document.body.appendChild(el);
    el.select();
    document.execCommand("copy");
    el.remove();
};

export { copyText };
