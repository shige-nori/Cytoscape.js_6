import requests
from bs4 import BeautifulSoup
import pandas as pd

def scrape_researchmap_faq(url):
    # 1. ページのデータを取りに行く
    response = requests.get(url)
    response.encoding = response.apparent_encoding  # 文字化け防止
    
    if response.status_code != 200:
        print(f"ページの取得に失敗しました。ステータスコード: {response.status_code}")
        return

    soup = BeautifulSoup(response.text, 'html.parser')

    # 2. 質問と回答を格納するリスト
    faq_data = []

    # researchmapのFAQ構造（dlタグ内のdtが質問、ddが回答）を解析
    # ※サイト構造に基づき、適切なクラスやタグを指定
    faq_items = soup.find_all(['dt', 'dd'])

    current_q = None
    for item in faq_items:
        if item.name == 'dt':
            current_q = item.get_text(strip=True)
        elif item.name == 'dd' and current_q:
            current_a = item.get_text(strip=True)
            faq_data.append({'質問': current_q, '回答': current_a})
            current_q = None  # 次のペアのためにリセット

    # 3. Excelに出力
    if faq_data:
        df = pd.DataFrame(faq_data)
        filename = "researchmap_faq.xlsx"
        df.to_excel(filename, index=False)
        print(f"成功！ '{filename}' にデータを保存しました。")
    else:
        print("FAQデータが見つかりませんでした。サイトの構造が変更されている可能性があります。")

# 実行
url = "https://researchmap.jp/public/FAQ-1"
scrape_researchmap_faq(url)
