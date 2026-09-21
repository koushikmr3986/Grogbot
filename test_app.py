import unittest
import json
import os
from app import app, FREE_QUERY_LIMIT, PRICE_PER_QUESTION_INR, extract_metadata, detect_image_intent, generate_image_url

class TestBramhastra26(unittest.TestCase):
    def setUp(self):
        app.config['TESTING'] = True
        app.config['SECRET_KEY'] = 'test_secret_key'
        self.client = app.test_client()

    def test_status_endpoint(self):
        response = self.client.get('/api/status')
        self.assertEqual(response.status_code, 200)
        data = response.get_json()
        self.assertIn('query_count', data)
        self.assertEqual(data['free_limit'], FREE_QUERY_LIMIT)
        self.assertEqual(data['price_per_question'], PRICE_PER_QUESTION_INR)

    def test_metadata_extraction(self):
        sample_reply = "The speed of light in vacuum is approximately 299,792,458 meters per second.<!--META:{\"emotion\":\"Analytical\",\"image_prompt\":\"speed of light photon beam\"}-->"
        clean_text, emotion, image_prompt = extract_metadata(sample_reply)
        self.assertEqual(clean_text, "The speed of light in vacuum is approximately 299,792,458 meters per second.")
        self.assertEqual(emotion, "Analytical")
        self.assertEqual(image_prompt, "speed of light photon beam")

    def test_image_intent_detection(self):
        query1 = "Can you show me a picture of an Indian elephant?"
        prompt1 = detect_image_intent(query1)
        self.assertIsNotNone(prompt1)
        self.assertIn("elephant", prompt1.lower())

        query2 = "What is the capital of France?"
        prompt2 = detect_image_intent(query2)
        self.assertIsNone(prompt2)

    def test_image_url_generation(self):
        url = generate_image_url("majestic cosmic galaxy")
        self.assertIsNotNone(url)
        self.assertTrue(url.startswith("https://image.pollinations.ai/prompt/"))
        self.assertIn("galaxy", url)

    def test_query_limit_and_upgrade_flow(self):
        # Reset session
        self.client.post('/api/reset')

        # Simulate reaching query limit (20 questions)
        with self.client.session_transaction() as sess:
            sess['query_count'] = 20
            sess['is_premium'] = False
            sess['premium_credits'] = 0

        # The 21st query should be blocked with 403 requires_upgrade
        response = self.client.post('/api/chat', json={"message": "What is gravity?"})
        self.assertEqual(response.status_code, 403)
        data = response.get_json()
        self.assertEqual(data['error'], 'LIMIT_EXCEEDED')
        self.assertTrue(data['requires_upgrade'])
        self.assertIn("₹5", data['message'])

        # Now simulate upgrade to Premium
        upgrade_resp = self.client.post('/api/upgrade', json={"pack": "pack_10"})
        self.assertEqual(upgrade_resp.status_code, 200)
        upgrade_data = upgrade_resp.get_json()
        self.assertTrue(upgrade_data['is_premium'])
        self.assertEqual(upgrade_data['premium_credits'], 10)

        # Status check after upgrade
        status_resp = self.client.get('/api/status')
        status_data = status_resp.get_json()
        self.assertTrue(status_data['is_premium'])
        self.assertEqual(status_data['premium_credits'], 10)

if __name__ == '__main__':
    unittest.main()
