// cms-loader.js
const BACKEND_URL = 'http://localhost:3000'; // آدرس سرور بک‌اند شما

document.addEventListener("DOMContentLoaded", async () => {
    // پیدا کردن نام صفحه جاری بر اساس تگ دیتا در body یا نام فایل HTML
    const pageName = document.body.getAttribute("data-page-id") || "home";

    try {
        const response = await fetch(`${BACKEND_URL}/api/content/${pageName}`);
        const contents = await response.json();

        contents.forEach(item => {
            if (item.type === 'text') {
                // پیدا کردن المان‌هایی که منتظر این کلید هستند
                const elements = document.querySelectorAll(`[data-cms-text="${item.key}"]`);
                elements.forEach(el => {
                    el.innerHTML = item.value;
                });
            } else if (item.type === 'image') {
                // پیدا کردن تصاویر یا بخش‌هایی که بک‌گراند دارند
                const images = document.querySelectorAll(`[data-cms-img="${item.key}"]`);
                images.forEach(img => {
                    if (img.tagName.toLowerCase() === 'img') {
                        img.src = `${BACKEND_URL}${item.value}`;
                    } else {
                        // اگر المان div یا section بود، آن را به عنوان background-image ست کن
                        img.style.backgroundImage = `url('${BACKEND_URL}${item.value}')`;
                    }
                });
            }
        });
    } catch (error) {
        console.error("CMS Loader Error: دیتای داینامیک لود نشد، دیتای پیش‌فرض HTML نمایش داده می‌شود.", error);
    }
});