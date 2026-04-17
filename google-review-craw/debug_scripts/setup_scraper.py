import sqlite3
import yaml
import os

def generate_config():
    # 1. Read cinemas from dev.db
    conn = sqlite3.connect('dev.db')
    cursor = conn.cursor()
    cursor.execute("SELECT placeId, name FROM Cinema")
    cinemas = cursor.fetchall()
    conn.close()

    if not cinemas:
        print("No cinemas found in dev.db")
        return

    print(f"Found {len(cinemas)} cinemas in dev.db")

    # 2. Read base config
    try:
        with open('config.sample.yaml', 'r', encoding='utf-8') as f:
            config = yaml.safe_load(f)
    except Exception as e:
        print(f"Error reading config.sample.yaml: {e}")
        return

    # 3. Modify base config settings
    config['headless'] = True
    config['max_reviews'] = 0  # 0 means unlimited
    config['download_images'] = False  # Set False for 44 cinemas to save massive bandwidth/space
    
    config['scrape_mode'] = 'update'
    config['use_mongodb'] = True
    config['mongodb'] = {
        'uri': os.environ.get('MONGODB_URI', 'mongodb+srv://USER:PASSWORD@CLUSTER.mongodb.net/?retryWrites=true&w=majority'),
        'database': 'reviews',
        'collection': 'reviews',
        'sync_mode': 'update',
        'tls_allow_invalid_certs': False
    }

    # 4. Generate businesses list
    businesses = []
    for place_id, name in cinemas:
        if not place_id:
            continue
        
        businesses.append({
            'url': f"https://www.google.com/maps/search/?api=1&query=Google&query_place_id={place_id}",
            'custom_params': {
                'company': name
            }
        })
    
    config['businesses'] = businesses

    # 5. Write out to config.yaml
    with open('config.yaml', 'w', encoding='utf-8') as f:
        yaml.dump(config, f, allow_unicode=True, default_flow_style=False, sort_keys=False)
        
    print("Successfully created config.yaml with 44 cinemas.")

if __name__ == '__main__':
    generate_config()
