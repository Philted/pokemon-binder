from flask import Flask, jsonify, request, send_from_directory, render_template
import json
import os

app = Flask(__name__, static_folder="static", template_folder="templates")

# Load card data including settings
def load_cards(set_code):
    json_file = os.path.join(app.root_path, f"binders/{set_code}.json")
    with open(json_file, "r") as f:
        return json.load(f)

# Save card data
def save_cards(set_code, cards):
    json_file = os.path.join(app.root_path, f"binders/{set_code}.json")
    with open(json_file, "w") as f:
        json.dump(cards, f, indent=4)

# Get images for the first page of each binder
def get_first_page_images():
    sets = ['scarlet_violet', 'paldea_evolved', 'obsidian_flame', 'paradox_rift', 'temporal_forces', 'twilight_masquerade','stellar_crown', 'surging_sparks']
    first_page_images = {}
    for set_code in sets:
        data = load_cards(set_code)
        first_page = data["cards"][:data["settings"]["width"] * data["settings"]["height"]]
        first_page_images[set_code] = [f"/static/{card['image']}" for card in first_page]
    return first_page_images

# Route to serve the main page
@app.route("/")
def index():
    return render_template("index.html")

# API to get the first page images for each binder
@app.route("/api/first_page_images", methods=["GET"])
def first_page_images():
    return jsonify(get_first_page_images())

# API to get a specific page of a binder
@app.route("/api/binder_page", methods=["GET"])
def get_binder_page():
    set_code = request.args.get("set")
    page_number = int(request.args.get("page"))
    data = load_cards(set_code)
    settings = data["settings"]
    page_size = settings["width"] * settings["height"]
    start_index = page_number * page_size
    end_index = start_index + page_size
    return jsonify({"page": data["cards"][start_index:end_index]})

# API to get all cards in a binder
@app.route("/api/binder", methods=["GET"])
def get_binder():
    set_code = request.args.get("set")
    data = load_cards(set_code)
    settings = data["settings"]
    page_size = settings["width"] * settings["height"]
    pages = [data["cards"][i:i + page_size] for i in range(0, len(data["cards"]), page_size)]
    return jsonify({"pages": pages, "settings": settings, "set_name": data["set_name"]})

# API to update a card's quantity
@app.route("/api/cards/update", methods=["POST"])
def update_card():
    data = request.json
    set_code = data.get("set_code")
    card_id = data.get("card_id")
    change = data.get("change")

    cards_data = load_cards(set_code)
    for card in cards_data["cards"]:
        if card["id"] == card_id:
            card["quantity"] = max(0, card["quantity"] + change)
            save_cards(set_code, cards_data)
            return jsonify({"success": True, "card": card})

    return jsonify({"success": False, "error": "Card not found"}), 404

# API to update the binder settings
@app.route("/api/binder/settings/update", methods=["POST"])
def update_binder_settings():
    data = request.json
    set_code = data.get("set_code")
    new_settings = data.get("settings")

    cards_data = load_cards(set_code)
    cards_data["settings"] = new_settings
    save_cards(set_code, cards_data)

    return jsonify({"success": True, "settings": new_settings})

# API to reset the binder
@app.route("/api/binder/reset", methods=["POST"])
def reset_binder():
    set_code = request.json.get("set_code")

    cards_data = load_cards(set_code)
    for card in cards_data["cards"]:
        card["quantity"] = 0
    save_cards(set_code, cards_data)

    return jsonify({"success": True})

# Serve static files (images, CSS, JS)
@app.route("/static/<path:path>")
def serve_static(path):
    return send_from_directory(app.static_folder, path)

if __name__ == "__main__":
    app.run(debug=True)
