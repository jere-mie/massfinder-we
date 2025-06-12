class AppListSection extends HTMLElement {
    constructor() {
        super();
    }

    connectedCallback() {
        this.innerHTML = /* html */`
        <style>
            app-listsection {
                text-align: left;
            }

            .caret-icon {
                transition: transform 0.3s;
                margin-left: 0.5em;
            }

            .caret-rotated {
                transform: rotate(180deg);
            }

            .listsection-btn-content {
                display: flex;
                align-items: center;
                justify-content: space-between;
                width: 100%;
            }
        </style>
        <template x-for="church in $store.app.filteredChurches" :key="church.name">
            <div x-data="{ collapse: false }">
                <button class="btn btn-light w-100 text-start mb-2" type="button" @click="collapse = !collapse"
                    :aria-expanded="collapse" :aria-controls="church.name.replace(/\\s+/g, '') + '-collapse'">
                    <span class="listsection-btn-content">
                        <span x-text="church.name"></span>
                        <i class="fas fa-caret-down caret-icon" :class="{ 'caret-rotated': collapse }" aria-hidden="true"></i>
                    </span>
                </button>
                <div x-show="collapse" x-transition:enter="transition ease-out duration-300">
                    <div x-html="$store.app.getPopup(church)"></div>
                </div>
            </div>
        </template>
        `;
    }
}

customElements.define('app-listsection', AppListSection);