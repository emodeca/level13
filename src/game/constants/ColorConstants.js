define(function () {
    
    var ColorConstants = {
        
        // Any colors that are defined in .less should be kept in sync with the value in .less
        
        colors: {
            dark: {
                bg: "#202220",
                bg_box_1: "#282a28",
                border_element: "#bbb",
                map_stroke_grid: "#343434",
                map_stroke_sector: "#ddee66",
                map_stroke_sector_hazard: "#ee4444",
                map_stroke_sector_sunlit: "#ffee11",
                map_stroke_movementlines: "#3a3a3a",
                map_fill_sector_unvisited: "#3a3a3a",
                map_fill_sector_unscouted: "#666",
                map_fill_sector_scouted: "#999",
                map_fill_sector_cleared: "#ccc",
                map_stroke_gang: "#dd0000",
                map_stroke_blocker: "#dd0000",
                techtree_arrow: "#777",
                techtree_arrow_dimmed: "#555",
                techtree_node_unlocked: "#ccc",
                techtree_node_available: "#777",
                techtree_node_default: "#777",
                techtree_node_dimmed: "#444",
            },
            sunlit: {
                bg: "#fdfdfd",
                bg_box_1: "#efefef",
                border_element: "#666",
                map_stroke_grid: "#d9d9d9",
                map_stroke_sector: "#ddee66",
                map_stroke_sector_hazard: "#ee4444",
                map_stroke_sector_sunlit: "#ffee11",
                map_stroke_movementlines:  "#b0b0b0",
                map_fill_sector_unvisited: "#d0d0d0",
                map_fill_sector_unscouted: "#bbb",
                map_fill_sector_scouted: "#888",
                map_fill_sector_cleared: "#555",
                map_stroke_gang: "#dd0000",
                map_stroke_blocker: "#dd0000",
                techtree_arrow: "#999",
                techtree_arrow_dimmed: "#ccc",
                techtree_node_unlocked: "#999",
                techtree_node_available: "#ccc",
                techtree_node_default: "#ccc",
                techtree_node_dimmed: "#eee",
            },
            global: {
                res_metal: "#202020",
                res_water: "#2299ff",
                res_food: "#ff6622",
                res_fuel: "#dd66cc",
            }
        },
        
        getColor: function (sunlit, name) {
            var theme = sunlit ? "sunlit" : "dark";
            var color = this.colors[theme][name];
            if (!color) {
                console.log("WARN: No such color: " + name);
                return "#000";
            }
            return color;
        },
        
        getGlobalColor: function (name) {
            var color = this.colors.global[name];
            if (!color) {
                console.log("WARN: No such color: " + name);
                return "#000";
            }
            return color;
        }
        
    };
    return ColorConstants;
});