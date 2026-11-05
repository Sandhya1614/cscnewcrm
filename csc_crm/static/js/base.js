
    setTimeout(() => {

        const messages = document.querySelector('.messages-container');

        if(messages){
            messages.style.opacity = '0';

            setTimeout(() => {
                messages.style.display = 'none';
            }, 500);
        }

    }, 3000);

// For Hamburger Menu
const menuToggle = document.getElementById("menuToggle");
const moduleTabs = document.getElementById("moduleTabs");
const icon = menuToggle.querySelector("i");

function openMenu(){
    moduleTabs.classList.add("show");
    icon.classList.remove("fa-bars");
    icon.classList.add("fa-times");
}

function closeMenu(){
    moduleTabs.classList.remove("show");
    icon.classList.remove("fa-times");
    icon.classList.add("fa-bars");
}

menuToggle.addEventListener("click", (e) => {
    e.stopPropagation();

    if(moduleTabs.classList.contains("show")){
        closeMenu();
    }else{
        openMenu();
    }
});

document.addEventListener("click", (e) => {
    if(
        !moduleTabs.contains(e.target) &&
        !menuToggle.contains(e.target)
    ){
        closeMenu();
    }
});