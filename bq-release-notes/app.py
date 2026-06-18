import os
import re
import xml.etree.ElementTree as ET
from flask import Flask, jsonify, render_template, request
import requests

app = Flask(__name__)

FEED_URL = "https://docs.cloud.google.com/feeds/bigquery-release-notes.xml"

def parse_release_notes(xml_content):
    ns = {'atom': 'http://www.w3.org/2005/Atom'}
    root = ET.fromstring(xml_content)
    
    entries = []
    # Feed title
    feed_title_elem = root.find('atom:title', ns)
    feed_title = feed_title_elem.text if feed_title_elem is not None else "BigQuery Release Notes"

    for entry in root.findall('atom:entry', ns):
        date_str = entry.find('atom:title', ns).text
        updated = entry.find('atom:updated', ns).text
        
        # Link extraction
        link_elem = entry.find('atom:link[@rel="alternate"]', ns)
        if link_elem is None:
            link_elem = entry.find('atom:link', ns)
        link = link_elem.attrib.get('href', '') if link_elem is not None else ''
        
        # Unique ID for each entry
        entry_id_elem = entry.find('atom:id', ns)
        entry_id = entry_id_elem.text if entry_id_elem is not None else f"release-{date_str.replace(' ', '_')}"
        
        content_elem = entry.find('atom:content', ns)
        content_html = content_elem.text if content_elem is not None else ''
        
        # Split individual update items under the date
        items = []
        parts = re.split(r'<h3>', content_html)
        
        item_counter = 0
        for part in parts[1:]:
            subparts = part.split('</h3>', 1)
            if len(subparts) == 2:
                update_type = subparts[0].strip()
                update_body = subparts[1].strip()
                item_id = f"{entry_id}_item_{item_counter}"
                item_counter += 1
                items.append({
                    'id': item_id,
                    'type': update_type,
                    'body': update_body
                })
        
        # Fallback if no <h3> tags but content exists
        if not items and content_html.strip():
            items.append({
                'id': f"{entry_id}_item_0",
                'type': 'General',
                'body': content_html.strip()
            })
            
        entries.append({
            'date': date_str,
            'updated': updated,
            'link': link,
            'items': items
        })
        
    return {
        'title': feed_title,
        'entries': entries
    }

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/release-notes')
def get_release_notes():
    try:
        response = requests.get(FEED_URL, timeout=10)
        response.raise_for_status()
        data = parse_release_notes(response.content)
        return jsonify(data)
    except Exception as e:
        app.logger.error(f"Error fetching release notes: {e}")
        return jsonify({'error': f"Failed to fetch release notes: {str(e)}"}), 500

if __name__ == '__main__':
    # Run server on port 5000
    app.run(debug=True, host='127.0.0.1', port=5000)
